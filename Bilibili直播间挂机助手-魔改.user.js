// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.4.28
// @description  Bilibili直播间自动签到，领瓜子，参加抽奖，完成任务，送礼等
// @author       SeaLoong,pjy612
// @updateURL    https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @downloadURL  https://raw.githubusercontent.com/pjy612/Bilibili-LRHH/master/Bilibili%E7%9B%B4%E6%92%AD%E9%97%B4%E6%8C%82%E6%9C%BA%E5%8A%A9%E6%89%8B-%E9%AD%94%E6%94%B9.user.js
// @homepageURL  https://github.com/pjy612/Bilibili-LRHH
// @supportURL   https://github.com/pjy612/Bilibili-LRHH/issues
// @include      /https?:\/\/live\.bilibili\.com\/[blanc\/]?[^?]*?\d+\??.*/
// @include      /https?:\/\/api\.live\.bilibili\.com\/_.*/
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      https://greasyfork.org/scripts/390500-bilibiliapi-plus/code/BilibiliAPI_Plus.js
// @require      https://js-1258131272.file.myqcloud.com/OCRAD.min.js
// @run-at       document-start
// @license      MIT License
// @grant        none
// ==/UserScript==
/*
瓜子初始化失败问题自行替换上方对应OCRAD源
[greasyfork源]
// @require      https://greasyfork.org/scripts/44866-ocrad/code/OCRAD.js
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
    const VERSION = '2.4.4.28';
    try{
        var tmpcache = JSON.parse(localStorage.getItem(`${NAME}_CACHE`));
        const t = Date.now() / 1000;
        if (t - tmpcache.unique_check >= 0 && t - tmpcache.unique_check <= 60) {
            return;
        }else{
            //启动脚本时改域 修复天选
            document.domain = 'bilibili.com';
        }
    }catch(e){
        document.domain = 'bilibili.com';
    }
    let API;

    //const window = unsafeWindow;
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
        awardBlocked:false
    };

    const tz_offset = new Date().getTimezoneOffset() + 480;

    const ts_s = () => Math.round(ts_ms() / 1000);

    const ts_ms = () => Date.now();

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
    if (isSubScript()) {
        try {
            let host_server_list = [];
            try {
                // 拦截弹幕服务器连接
                const webSocketConstructor = WebSocket.prototype.constructor;
                WebSocket.prototype.constructor = (url, protocols) => {
                    return webSocketConstructor(url, protocols);
                };
            } catch (err) {};
            try {
                // 拦截直播流
                window.fetch = () => new Promise(() => {
                    throw new Error();
                });
            } catch (err) {};
            try {
                // 清空页面元素和节点
                if(window.location.pathname.indexOf('anchor')!=-1){
                    //天选的窗口不清空内容
                }else{
                    $('html').remove();
                }
            } catch (err) {};
            DEBUG('initing', window.frameElement[NAME]);
            // 读取父脚本数据
            window.toast = window.parent.toast;
            try {
                API = BilibiliAPI;
            } catch (err) {
                window.toast('子页面BilibiliAPI初始化失败，子脚本已停用！', 'error');
                console.error(`[${NAME}]`, err);
                return;
            }
            Info = window.parent[NAME].Info;
            CONFIG = window.parent[NAME].CONFIG;
            CACHE = window.parent[NAME].CACHE;
            API.setCommonArgs(Info.csrf_token, '');
            const down = () => {
                Info = window.parent[NAME].Info;
                CONFIG = window.parent[NAME].CONFIG;
                CACHE = window.parent[NAME].CACHE;
                const pDown = $.Deferred();
                pDown.then(down);
                window.frameElement[NAME].promise.down = pDown;
            };
            window.frameElement[NAME].promise.down.then(down);
            const up = () => {
                window.parent[NAME].Info = Info;
                window.parent[NAME].CACHE = CACHE;
                window.frameElement[NAME].promise.up.resolve();
            };
            window.frameElement[NAME].promise.init.resolve();
            if (window.frameElement[NAME].type === 'GROUPSIGN|DAILYREWARD') {
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
                                    up();
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
                                        up();
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
                    run: () => {
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
                            return API.i.taskInfo().then((response) => {
                                DEBUG('Task.run: API.i.taskInfo', response);
                                for (const key in response.data) {
                                    if (typeof response.data[key] === 'object') {
                                        if (response.data[key].task_id && response.data[key].status === 1) {
                                            Task.receiveAward(response.data[key].task_id);
                                        } else if (response.data[key].task_id === 'double_watch_task' && response.data[key].status === 2) Task.double_watch_task = true;
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
                    receiveAward: (task_id) => {
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
                    run: () => {
                        try {
                            if (!CONFIG.MOBILE_HEARTBEAT) return $.Deferred().resolve();
                            if (MobileHeartbeat.run_timer && !Task.double_watch_task && Info.mobile_verify) {
                                Task.MobileHeartbeat = true;
                                Task.run();
                            }
                            if (MobileHeartbeat.run_timer) clearTimeout(MobileHeartbeat.run_timer);
                            API.HeartBeat.mobile().then(() => {
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
                if (CONFIG.AUTO_GROUP_SIGN) GroupSign.run();
                if (CONFIG.AUTO_DAILYREWARD) DailyReward.run();
                if (CONFIG.MOBILE_HEARTBEAT) {
                    MobileHeartbeat.run();
                    WebHeartbeat.run();
                }
            } else {
                window.frameElement[NAME].promise.finish.resolve();
            }
        } catch (err) {
            console.error(`[${NAME}]子脚本运行时出现异常，已停止并关闭子页面`);
            console.error(`[${NAME}]`, err);
            window.frameElement[NAME].promise.finish.resolve();
        }
    } else {
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
                        const list = [];
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
                            a.style.top = (document.body.scrollTop + list.length * 40 + 10) + 'px';
                            a.style.left = (document.body.offsetWidth + document.body.scrollLeft - a.offsetWidth - 5) + 'px';
                            list.push(a);
                            setTimeout(() => {
                                a.className += ' out';
                                setTimeout(() => {
                                    list.shift();
                                    list.forEach((v) => {
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
                        GIFT_INTERVAL:10,
                        GIFT_LIMIT:86400,
                        GIFT_SORT:true,
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
                        GIFT_INTERVAL:'检查间隔(分钟)',
                        GIFT_SORT:'优先高等级',
                        GIFT_LIMIT:'到期时间(秒)',
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
                        ROOMID: '数组,送礼物的直播间ID(即地址中live.bilibili.com/后面的数字), 设置为0则不送礼，小于0也视为0（因为你没有0的勋章）<br>例如：17171,21438956<br>不管[优先高等级]如何设置，会根据[送满全部勋章]（补满或者只消耗当日到期）条件去优先送17171的，再送21438956<br>之后根据[优先高等级]决定送高级还是低级',
                        GIFT_INTERVAL:'检查间隔(分钟)',
                        GIFT_SORT:'打钩优先赠送高等级勋章，不打勾优先赠送低等级勋章',
                        GIFT_LIMIT:'到期时间范围（秒），86400为1天，时间小于1天的会被送掉',
                        GIFT_DEFAULT: () => (`设置默认送的礼物类型编号，多个请用英文逗号(,)隔开，为空则表示默认不送出礼物<br>${Info.gift_list_str}`),
                        GIFT_ALLOWED: () => (`设置允许送的礼物类型编号(任何未在此列表的礼物一定不会被送出!)，多个请用英文逗号(,)隔开，为空则表示允许送出所有类型的礼物<br><br>${Info.gift_list_str}`),
                        SEND_ALL: '打钩 送满全部勋章，否则 送出包裹中今天到期的礼物(会送出"默认礼物类型"之外的礼物，若今日亲密度已满则不送)'
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

                    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL === undefined) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = Essential.Config.AUTO_GIFT_CONFIG.GIFT_INTERVAL;
                    if (config.AUTO_GIFT_CONFIG.GIFT_INTERVAL < 1) config.AUTO_GIFT_CONFIG.GIFT_INTERVAL = 1;
                    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT === undefined) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = Essential.Config.AUTO_GIFT_CONFIG.GIFT_LIMIT;
                    if (config.AUTO_GIFT_CONFIG.GIFT_LIMIT < 0) config.AUTO_GIFT_CONFIG.GIFT_LIMIT = 86400;
                    if (config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE === undefined) config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE = Essential.Config.AUTO_LOTTERY_CONFIG.SLEEP_RANGE;

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
                    BiliPushUtils.Check.sleepTimeRangeBuild();
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

        const Task = {
            interval: 600e3,
            double_watch_task: false,
            run_timer: undefined,
            MobileHeartbeat: false,
            run: () => {
                try {
                    if (!CONFIG.AUTO_TASK) return $.Deferred().resolve();
                    if (!Info.mobile_verify) {
                        window.toast('[自动完成任务]未绑定手机，已停止', 'caution');
                        return $.Deferred().resolve();
                    }
                    if (Task.run_timer) clearTimeout(Task.run_timer);
                    if (CACHE.task_ts && !Task.MobileHeartbeat) {
                        const diff = ts_ms() - CACHE.task_ts;
                        if (diff < Task.interval) {
                            Task.run_timer = setTimeout(Task.run, Task.interval - diff);
                            return $.Deferred().resolve();
                        }
                    }
                    if (Task.MobileHeartbeat) Task.MobileHeartbeat = false;
                    return API.i.taskInfo().then((response) => {
                        DEBUG('Task.run: API.i.taskInfo', response);
                        for (const key in response.data) {
                            if (typeof response.data[key] === 'object') {
                                if (response.data[key].task_id && response.data[key].status === 1) {
                                    Task.receiveAward(response.data[key].task_id);
                                } else if (response.data[key].task_id === 'double_watch_task' && response.data[key].status === 2) Task.double_watch_task = true;
                            }
                        }
                    }).always(() => {
                        CACHE.task_ts = ts_ms();
                        Essential.Cache.save();
                        Task.run_timer = setTimeout(Task.run, Task.interval);
                    }, () => delayCall(() => Task.run()));
                } catch (err) {
                    window.toast('[自动完成任务]运行时出现异常，已停止', 'error');
                    console.error(`[${NAME}]`, err);
                    return $.Deferred().reject();
                }
            },
            receiveAward: (task_id) => {
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

        const Gift = {
            interval: 600e3,
            run_timer: undefined,
            ruid: undefined,
            room_id: undefined,
            medal_list: undefined,
            bag_list: undefined,
            time: undefined,
            remain_feed: undefined,
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
                    DEBUG('Gift.run: Gift.getMedalList().then: Gift.medal_list', Gift.medal_list);
                    if(Gift.medal_list && Gift.medal_list.length>0){
                        Gift.medal_list = Gift.medal_list.filter(it=>it.dayLimit-it.today_feed>0 && it.level < 20);
                        if(CONFIG.AUTO_GIFT_CONFIG.GIFT_SORT){
                            Gift.medal_list.sort((a,b)=>{
                                if(b.level-a.level==0){
                                    return b.intimacy-a.intimacy;
                                }
                                return b.level-a.level;
                            });
                        }else{
                            Gift.medal_list.sort((a,b)=>{
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
                                let rindex = Gift.medal_list.findIndex(r=>r.roomid==froom);
                                if(rindex!=-1){
                                    let tmp = Gift.medal_list[rindex];
                                    Gift.medal_list.splice(rindex,1);
                                    Gift.medal_list.unshift(tmp);
                                }
                            }
                        }
                        let limit = CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT;
                        for(let v of Gift.medal_list){
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
                                    window.toast(`[自动送礼]勋章[${v.medalName}] 今日亲密度未满[${v.today_feed}/${v.day_limit}]，预计需要${Gift.remain_feed}送礼开始`, 'info');
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
                if (
                    //特殊礼物排除
                    (![4, 3, 9, 10].includes(v.gift_id)
                     //满足到期时间
                     && v.expire_at > Gift.time && (v.expire_at - Gift.time < CONFIG.AUTO_GIFT_CONFIG.GIFT_LIMIT)
                    )
                    //或者全部送满
                    || CONFIG.AUTO_GIFT_CONFIG.SEND_ALL){
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
                                    window.toast(`[自动送礼]勋章[${medal.medalName}] 送礼成功，送出${feed_num}个${v.gift_name}，[${medal.today_feed}/${medal.day_limit}]距离升级还需 ${Gift.remain_feed}`, 'success');
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

        const MobileHeartbeat = {
            run_timer: undefined,
            run: () => {
                try {
                    if (!CONFIG.MOBILE_HEARTBEAT) return $.Deferred().resolve();
                    if (MobileHeartbeat.run_timer && !Task.double_watch_task && Info.mobile_verify) {
                        Task.MobileHeartbeat = true;
                        Task.run();
                    }
                    if (MobileHeartbeat.run_timer) clearTimeout(MobileHeartbeat.run_timer);
                    return API.HeartBeat.mobile().then(() => {
                        DEBUG('MobileHeartbeat.run: API.HeartBeat.mobile');
                        MobileHeartbeat.run_timer = setTimeout(MobileHeartbeat.run, 300e3);
                    }, () => delayCall(() => MobileHeartbeat.run()));
                    /*
                    return BiliPushUtils.API.Heart.mobile().then((rsp)=>{
                        DEBUG('MobileHeartbeat.run: API.HeartBeat.mobile',JSON.parse(rsp.responseText));
                        MobileHeartbeat.run_timer = setTimeout(MobileHeartbeat.run, 300e3);
                    }).catch((rsp)=>{
                        return delayCall(() => MobileHeartbeat.run())
                    });
                    */
                } catch (err) {
                    window.toast('[移动端心跳]运行时出现异常，已停止', 'error');
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
                            const p = $.Deferred();
                            setTimeout(() => {
                                TreasureBox.captcha.calc().then((captcha) => {
                                    TreasureBox.getAward(captcha, cnt + 1).then(() => p.resolve(), () => p.reject());
                                }, () => p.reject());
                            }, 3e3);
                            return p;
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
                check: (aid, valid = 439, rem = 9) => { // TODO
                    aid = parseInt(aid || (CACHE.last_aid), 10);
                    if (isNaN(aid)) aid = valid;
                    DEBUG('Lottery.MaterialObject.check: aid=', aid);
                    return API.Lottery.MaterialObject.getStatus(aid).then((response) => {
                        DEBUG('Lottery.MaterialObject.check: API.Lottery.MaterialObject.getStatus', response);
                        if (response.code === 0) {
                            if (CONFIG.AUTO_LOTTERY_CONFIG.MATERIAL_OBJECT_LOTTERY_CONFIG.IGNORE_QUESTIONABLE_LOTTERY && Lottery.MaterialObject.ignore_keyword.some(v => response.data.title.toLowerCase().indexOf(v) > -1)) {
                                window.toast(`[自动抽奖][实物抽奖]忽略抽奖(aid=${aid})`, 'info');
                                return Lottery.MaterialObject.check(aid + 1, aid);
                            } else {
                                return Lottery.MaterialObject.join(aid, response.data.title, response.data.typeB).then(() => Lottery.MaterialObject.check(aid + 1, aid));
                            }
                        } else if (response.code === -400) { // 活动不存在
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
                Essential.init().then(() => {
                    console.log("魔改脚本加载成功...")
                    try {
                        API = BilibiliAPI;
                    } catch (err) {
                        window.toast('BilibiliAPI初始化失败，脚本已停用！', 'error');
                        console.error(`[${NAME}]`, err);
                        return p1.reject();
                    }
                    let blancFrames = $('iframe');
                    let pass = true;
                    if(blancFrames && blancFrames.length>0){
                        blancFrames.each((k,v)=>{
                            if(v.src.includes('/blanc/')){
                                pass = false;
                                window.toast('检查到特殊活动页，尝试跳转...', 'info',10e3);
                                setTimeout(()=>{
                                    location.href = v.src;
                                },10);
                                return true;
                            }
                        });
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
                                    //if (parseInt(window.BilibiliLive.UID, 10) === 0 || isNaN(parseInt(window.BilibiliLive.UID, 10))) {
                                    //    window.toast('你还没有登录，助手无法使用！', 'caution');
                                    //    p.reject();
                                    //    return true;
                                    //}
                                    const getCookie = (name) => {
                                        let arr;
                                        const reg = new RegExp(`(^| )${name}=([^;]*)(;|$)`);
                                        if ((arr = document.cookie.match(reg))) {
                                            return unescape(arr[2]);
                                        } else {
                                            return null;
                                        }
                                    };
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
                                        if(response.code!=0){
                                            window.toast('你还没有登录，助手无法使用！', 'caution');
                                            p.reject();
                                            return;
                                        }
                                        Info.silver = response.data.wallet.silver;
                                        Info.gold = response.data.wallet.gold;
                                        Info.uid = response.data.info.uid;
                                        Info.mobile_verify = response.data.info.mobile_verify;
                                        Info.identification = response.data.info.identification;
                                    });
                                    const p2 = API.gift.gift_config().then((response) => {
                                        DEBUG('InitData: API.gift.gift_config', response);
                                        Info.gift_list = response.data;
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
                    headers:{},
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
                    let option = BiliPushUtils._corsAjaxSetting(setting);
                    option.onload=(rsp)=>{
                        p.resolve(rsp);
                        return true;
                    };
                    option.onerror=(err)=>{
                        p.reject(err);
                        return true;
                    }
                    GM_xmlhttpRequest(option);
                });
                return p;
            },
            _corsAjaxSetting:(setting)=>{
                let url = (setting.url.substr(0, 2) === '//' ? location.protocol+'//' : location.protocol + '//api.live.bilibili.com/') + setting.url;
                let option = {
                    url:url,
                    method:setting.method || "GET",
                    headers:{},
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
                    mobile:(success)=>{
                        return BiliPushUtils.corsAjaxWithCommonArgs({
                            method: 'POST',
                            url: 'mobile/userOnlineHeart',
                            data: {'roomid': 23058, 'scale': 'xhdpi'}
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
                    const nh = now.getHours();
                    const nm = now.getMinutes();
                    let f = srange.find(it=>(it.bh==nh && it.bm<=nm) || it.bh<nh && it.eh>nh || (it.eh==nh && it.em>=nm));
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
                    function process(){
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
                            return BiliPushUtils.API.Storm.join(id,roomid).then((response) => {
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
                            },(e,e1,e2) => {
                                BiliPushUtils.Storm.over(id);
                                window.toast(`[自动抽奖][节奏风暴]抽奖(roomid=${roomid},id=${id})疑似触发风控,终止！\r\n尝试次数:${count}`, 'error');
                                console.error(e,e1,e2);
                                clearInterval(stormInterval);
                                return;
                            });
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
                    }),parseInt(Math.random()*6)*1e3);
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
            connectWebsocket :()=>{
                if(BiliPush.first){
                    window.toast('初始化bilipush 推送服务', 'info');
                }
                var data = { uid:BilibiliLive.UID,version:VERSION };
                var url="https://bilipush.1024dream.net:5000/ws/pre-connect";
                BiliPush._ajax(url,data,function(d){
                    if(d.code==-1){
                        window.toast('bilipush 拒绝连接:'+d.msg, 'error');
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
                            BiliPush.connectWebsocket();
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
                            BiliPush.connectWebsocket();
                        }, 5000);
                    };
                }, function (err) {
                    console.error("bilipush连接失败，等待重试...");
                    BiliPush.connected = false;
                    BiliPush.gsocketTimeId = setTimeout(function () {
                        BiliPush.connectWebsocket();
                    }, 5000);
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
                BiliPush.connectWebsocket();
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

        const Run = () => {
            // 每天一次
            Statistics.run();
            if (CONFIG.AUTO_SIGN) Sign.run();
            if (CONFIG.SILVER2COIN) Exchange.run();
            if (CONFIG.AUTO_GROUP_SIGN || CONFIG.AUTO_DAILYREWARD) createIframe('//api.live.bilibili.com', 'GROUPSIGN|DAILYREWARD');
            // 每过一定时间一次
            if (CONFIG.AUTO_TASK) Task.run();
            if (CONFIG.AUTO_GIFT) Gift.run();
            // 持续运行
            if (CONFIG.AUTO_TREASUREBOX) TreasureBox.run();
            if (CONFIG.AUTO_LOTTERY) Lottery.run();
            RafflePorcess.run();
            TopRankTask.run();
            BiliPush.run();
        };
        $.MsgBox = {
            Alert: function(title, msg) {
                GenerateHtml("alert", title, msg);
                btnOk(); //alert只是弹出消息，因此没必要用到回调函数callback
                btnNo();
            },
            Confirm: function(title, msg, callback) {
                GenerateHtml("confirm", title, msg);
                btnOk(callback);
                btnNo();
            }
        }
        //生成Html
        var GenerateHtml = function(type, title, msg) {
            if($("#mb_box,#mb_con").length>0){
                $("#mb_tit").html(title);
                $("#mb_msg").html(msg);
            }else{
                var _html = "";
                _html += '<div id="mb_box"></div><div id="mb_con"><span id="mb_tit">' + title + '</span>';
                _html += '<a id="mb_ico">x</a><div id="mb_msg">' + msg + '</div><div id="mb_btnbox">';
                if (type == "alert") {
                    _html += '<input id="mb_btn_ok" type="button" value="确定" />';
                }
                if (type == "confirm") {
                    _html += '<input id="mb_btn_ok" type="button" value="确定" />';
                    _html += '<input id="mb_btn_no" type="button" value="取消" />';
                }
                _html += '</div></div>';
                //必须先将_html添加到body，再设置Css样式
                $("body").append(_html);
                //生成Css
                GenerateCss();
            }
        }
        //生成Css
        var GenerateCss = function() {
            $("#mb_box").css({
                width: '100%',
                height: '100%',
                zIndex: '99999',
                position: 'fixed',
                filter: 'Alpha(opacity=60)',
                backgroundColor: 'black',
                top: '0',
                left: '0',
                opacity: '0.6'
            });
            $("#mb_con").css({
                zIndex: '999999',
                width: '400px',
                position: 'fixed',
                backgroundColor: 'White',
                borderRadius: '15px'
            });
            $("#mb_tit").css({
                display: 'block',
                fontSize: '14px',
                color: '#444',
                padding: '10px 15px',
                backgroundColor: '#DDD',
                borderRadius: '15px 15px 0 0',
                borderBottom: '3px solid #009BFE',
                fontWeight: 'bold'
            });
            $("#mb_msg").css({
                padding: '20px',
                lineHeight: '20px',
                borderBottom: '1px dashed #DDD',
                fontSize: '13px'
            });
            $("#mb_ico").css({
                display: 'block',
                position: 'absolute',
                right: '10px',
                top: '9px',
                border: '1px solid Gray',
                width: '18px',
                height: '18px',
                textAlign: 'center',
                lineHeight: '16px',
                cursor: 'pointer',
                borderRadius: '12px',
                fontFamily: '微软雅黑'
            });
            $("#mb_btnbox").css({
                margin: '15px 0 10px 0',
                textAlign: 'center'
            });
            $("#mb_btn_ok,#mb_btn_no").css({
                width: '85px',
                height: '30px',
                color: 'white',
                border: 'none'
            });
            $("#mb_btn_ok").css({
                backgroundColor: '#168bbb'
            });
            $("#mb_btn_no").css({
                backgroundColor: 'gray',
                marginLeft: '20px'
            });
            //右上角关闭按钮hover样式
            $("#mb_ico").hover(function() {
                $(this).css({
                    backgroundColor: 'Red',
                    color: 'White'
                });
            }, function() {
                $(this).css({
                    backgroundColor: '#DDD',
                    color: 'black'
                });
            });
            var _widht = document.documentElement.clientWidth; //屏幕宽
            var _height = document.documentElement.clientHeight; //屏幕高
            var boxWidth = $("#mb_con").width();
            var boxHeight = $("#mb_con").height();
            //让提示框居中
            $("#mb_con").css({
                top: (_height - boxHeight) / 2 + "px",
                left: (_widht - boxWidth) / 2 + "px"
            });
        }
        //确定按钮事件
        var btnOk = function(callback) {
            $("#mb_btn_ok").click(function() {
                $("#mb_box,#mb_con").remove();
                if (typeof(callback) == 'function') {
                    callback();
                }
            });
        }
        //取消按钮事件
        var btnNo = function() {
            $("#mb_btn_no,#mb_ico").click(function() {
                $("#mb_box,#mb_con").remove();
            });
        }
        $(document).ready(() => {
            Init().then(Run);
        });
    }
})();
