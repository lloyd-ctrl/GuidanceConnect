(function (global) {
    var STORAGE_KEY = 'guidanceconnect_accounts_v1';
    var SESSION_KEY = 'guidanceconnect_session_v1';
    var FLASH_KEY = 'guidanceconnect_flash_v1';

    function getAccounts() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveAccounts(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function hashPasswordLegacy(password) {
        var h = 5381;
        var i;
        for (i = 0; i < password.length; i++) {
            h = ((h << 5) + h + password.charCodeAt(i)) | 0;
        }
        return 'legacy:' + (h >>> 0).toString(16);
    }

    function hashPassword(password) {
        if (global.crypto && global.crypto.subtle) {
            var enc = new TextEncoder().encode(password);
            return global.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
                var arr = Array.from(new Uint8Array(buf));
                return arr
                    .map(function (b) {
                        return b.toString(16).padStart(2, '0');
                    })
                    .join('');
            });
        }
        return Promise.resolve(hashPasswordLegacy(password));
    }

    function registerAccount(data) {
        return hashPassword(data.password).then(function (hash) {
            var accounts = getAccounts();
            var sid = data.schoolId.trim();
            var email = data.email.trim().toLowerCase();
            var i;
            for (i = 0; i < accounts.length; i++) {
                if (accounts[i].schoolId.toLowerCase() === sid.toLowerCase()) {
                    return { ok: false, error: 'An account with this ID already exists.' };
                }
                if (accounts[i].email === email) {
                    return { ok: false, error: 'An account with this email already exists.' };
                }
            }
            accounts.push({
                fullName: data.fullName.trim(),
                schoolId: sid,
                email: email,
                role: data.role,
                passwordHash: hash,
                createdAt: new Date().toISOString()
            });
            saveAccounts(accounts);
            return { ok: true };
        });
    }

    function login(schoolId, password) {
        return hashPassword(password).then(function (hash) {
            var accounts = getAccounts();
            var sid = schoolId.trim();
            var user = null;
            var i;
            for (i = 0; i < accounts.length; i++) {
                if (accounts[i].schoolId.toLowerCase() === sid.toLowerCase()) {
                    user = accounts[i];
                    break;
                }
            }
            if (!user) {
                return { ok: false, error: 'ID or password is incorrect.' };
            }
            if (user.passwordHash !== hash) {
                return { ok: false, error: 'ID or password is incorrect.' };
            }
            if (user.status === 'suspended') {
                return { ok: false, error: 'This account is suspended. Contact the system administrator.' };
            }
            try {
                sessionStorage.setItem(
                    SESSION_KEY,
                    JSON.stringify({
                        schoolId: user.schoolId,
                        fullName: user.fullName,
                        role: user.role,
                        email: user.email
                    })
                );
            } catch (e) {}
            return { ok: true, user: user };
        });
    }

    function getSession() {
        try {
            var raw = sessionStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function logout() {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {}
    }

    function setFlash(msg) {
        try {
            sessionStorage.setItem(FLASH_KEY, msg);
        } catch (e) {}
    }

    function consumeFlash() {
        try {
            var msg = sessionStorage.getItem(FLASH_KEY);
            sessionStorage.removeItem(FLASH_KEY);
            return msg;
        } catch (e) {
            return null;
        }
    }

    global.GCAuth = {
        registerAccount: registerAccount,
        login: login,
        getSession: getSession,
        logout: logout,
        setFlash: setFlash,
        consumeFlash: consumeFlash
    };
})(typeof window !== 'undefined' ? window : this);
