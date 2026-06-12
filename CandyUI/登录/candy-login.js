/**
 * ============================================================
 * CandyLogin - 增强版登录组件
 * ============================================================
 * 功能特性：
 *   1. 基础登录表单（init / validate / submit / loader / message / reset / create）
 *   2. 记住密码功能（enableRememberMe / saveCredentials / loadCredentials / clearCredentials）
 *   3. 忘记密码（enableForgotPassword / showForgotPassword / handleForgotPassword）
 *   4. 社交登录（enableSocialLogin / socialLogin）支持 Google / Facebook / Twitter / GitHub / WeChat
 *   5. 图形验证码（enableCaptcha / generateCaptcha / validateCaptcha / refreshCaptcha）
 *   6. 密码可见性切换（enablePasswordToggle / togglePasswordVisibility）
 *   7. 登录尝试次数限制（setMaxAttempts / getAttempts / isLocked / resetAttempts）
 *   8. 账户锁定（lockAccount / unlockAccount / showLockedMessage / getLockRemainingTime）
 *   9. 记住用户名（enableRememberUsername）
 *  10. 增强的表单验证（validateUsername / validateEmail / validatePasswordStrength / showValidationErrors）
 *  11. 增强的消息系统（showSuccess / showError / showWarning / showInfo / clearMessage）
 *
 * 使用示例：
 *   CandyLogin.init({ formId: 'loginForm' });
 *   CandyLogin.enableRememberMe('loginForm');
 *   CandyLogin.enablePasswordToggle('loginForm');
 *   CandyLogin.enableCaptcha('loginForm');
 *   CandyLogin.enableSocialLogin('loginForm', { providers: ['google', 'wechat'] });
 *   CandyLogin.setMaxAttempts('loginForm', 5);
 * ============================================================
 */
const CandyLogin = {

    /** 存储所有已初始化的登录表单 */
    forms: {},

    /** localStorage 存储的前缀，避免与其他应用冲突 */
    _storagePrefix: 'candyLogin_',

    /* ============================================================
     * 1. 初始化与事件绑定
     * ============================================================ */

    /**
     * 初始化登录表单
     * @param {Object} options - 配置项
     * @param {string} options.formId - 表单ID（默认 'loginForm'）
     * @param {Function} options.onSubmit - 自定义提交回调
     * @param {boolean} options.autoRememberUsername - 是否自动记住用户名
     */
    init(options = {}) {
        const formId = options.formId || 'loginForm';
        const form = document.getElementById(formId);

        if (!form) {
            console.warn(`[CandyLogin] 未找到表单：#${formId}`);
            return;
        }

        // 每个表单维护独立的状态与配置
        this.forms[formId] = {
            form: form,
            config: options,
            // 登录尝试次数
            attempts: 0,
            maxAttempts: 5,
            // 锁定相关
            locked: false,
            lockUntil: 0,
            lockDuration: 0,
            // 验证码相关
            captchaCode: '',
            // 社交登录配置
            socialProviders: [],
            // 计时器引用（便于清理）
            _lockTimer: null
        };

        this.bindEvents(formId);
    },

    /**
     * 绑定基础表单事件（提交、失焦验证、输入清除错误）
     */
    bindEvents(formId) {
        const formData = this.forms[formId];
        const form = formData.form;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(formId);
        });

        const inputs = form.querySelectorAll('.candy-login-input');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });

            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    },

    /* ============================================================
     * 2. 表单提交与模拟登录
     * ============================================================ */

    /**
     * 处理表单提交
     * 会进行：锁定检测 → 表单验证 → 触发事件/回调
     */
    handleSubmit(formId) {
        const formData = this.forms[formId];
        if (!formData) return;

        const form = formData.form;
        const config = formData.config;

        // 如果已锁定，不允许继续提交
        if (this.isLocked(formId)) {
            this.showLockedMessage(formId);
            return;
        }

        this.showLoader(formId, true);
        this.clearMessage(formId);

        const data = this.getFormData(form);
        const isValid = this.validateForm(form);

        if (!isValid) {
            this.showLoader(formId, false);
            this.showError(formId, '请检查表单输入');
            return;
        }

        // 分发自定义事件（便于外部监听）
        form.dispatchEvent(new CustomEvent('candy-login-submit', {
            detail: { data, isValid },
            bubbles: true
        }));

        if (config.onSubmit) {
            // 交给外部处理，外部调用 success / error 控制后续行为
            config.onSubmit(data, {
                success: (message) => this._onSubmitSuccess(formId, message),
                error: (message) => this._onSubmitError(formId, message)
            });
        } else {
            this.simulateLogin(formId);
        }
    },

    /** 登录成功后统一处理：重置尝试次数、保存凭据等 */
    _onSubmitSuccess(formId, message) {
        this.resetAttempts(formId);
        this.unlockAccount(formId);
        this.saveCredentials(formId);
        this.saveRememberedUsername(formId);
        this.showLoader(formId, false);
        this.showSuccess(formId, message || '登录成功，正在跳转...');
        setTimeout(() => {
            if (window.location) {
                window.location.href = '/dashboard';
            }
        }, 1200);
    },

    /** 登录失败后统一处理：增加尝试次数、判断是否锁定 */
    _onSubmitError(formId, message) {
        this._incrementAttempts(formId);
        this.showLoader(formId, false);
        this.showError(formId, message || '用户名或密码错误');

        if (this.isLocked(formId)) {
            this.showLockedMessage(formId);
        }
    },

    /**
     * 内置的模拟登录逻辑（没有自定义 onSubmit 时使用）
     */
    simulateLogin(formId) {
        setTimeout(() => {
            const formData = this.forms[formId];
            if (!formData) return;

            const usernameInput = formData.form.querySelector('#username');
            const username = usernameInput ? usernameInput.value : '';

            if (username && username.length >= 3) {
                this._onSubmitSuccess(formId, '登录成功，正在跳转...');
            } else {
                this._onSubmitError(formId, '用户名或密码错误，请重试');
            }
        }, 1200);
    },

    /** 获取表单数据对象 */
    getFormData(form) {
        const data = {};
        const formData = new FormData(form);
        formData.forEach((value, key) => {
            data[key] = value;
        });
        return data;
    },

    /* ============================================================
     * 3. 基础表单验证
     * ============================================================ */

    /** 验证表单所有字段 */
    validateForm(form) {
        let isValid = true;
        const fields = form.querySelectorAll('.candy-login-input');
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        return isValid;
    },

    /** 验证单个字段（根据 type / id / required 推断规则） */
    validateField(field) {
        const value = field.value.trim();
        let isValid = true;

        if (field.hasAttribute('required') && !value) {
            isValid = false;
            this.showFieldError(field, '此项为必填');
        } else if (field.type === 'email' && value) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                isValid = false;
                this.showFieldError(field, '请输入有效的邮箱地址');
            }
        } else if ((field.id === 'password' || field.name === 'password') && value) {
            if (value.length < 6) {
                isValid = false;
                this.showFieldError(field, '密码至少需要 6 位');
            }
        }

        return isValid;
    },

    /** 显示单个字段错误信息 */
    showFieldError(field, message) {
        this.clearFieldError(field);
        const errorEl = document.createElement('div');
        errorEl.className = 'login-error';
        errorEl.textContent = message;
        errorEl.style.fontSize = '12px';
        errorEl.style.marginTop = '4px';
        errorEl.style.color = '#f87171';
        field.parentNode.appendChild(errorEl);
        field.style.borderColor = '#f87171';
    },

    /** 清除单个字段错误 */
    clearFieldError(field) {
        const errorEl = field.parentNode.querySelector('.login-error');
        if (errorEl) errorEl.remove();
        field.style.borderColor = '';
    },

    /* ============================================================
     * 4. 加载器 / 消息系统
     * ============================================================ */

    /**
     * 显示/隐藏提交中的加载动画
     */
    showLoader(formId, show) {
        const form = this.forms[formId]?.form;
        if (!form) return;

        const loader = form.querySelector('.loader');
        const button = form.querySelector('.candy-login-btn');

        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
        if (button) {
            button.disabled = !!show;
            if (!show && !button.dataset.originalText) {
                button.textContent = button.textContent || 'Sign In';
            }
        }
    },

    /**
     * 通用显示消息（兼容旧的 API）
     */
    showMessage(formId, message, type = 'info') {
        const form = this.forms[formId]?.form;
        if (!form) return;

        const messageEl = form.querySelector('.login-message') || form.querySelector('#message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `login-message login-${type} show`;
    },

    /** 隐藏消息 */
    hideMessage(formId) {
        this.clearMessage(formId);
    },

    /** 显示成功消息 */
    showSuccess(formId, message) {
        this.showMessage(formId, message, 'success');
    },

    /** 显示错误消息 */
    showError(formId, message) {
        this.showMessage(formId, message, 'error');
    },

    /** 显示警告消息 */
    showWarning(formId, message) {
        this.showMessage(formId, message, 'warning');
    },

    /** 显示信息消息 */
    showInfo(formId, message) {
        this.showMessage(formId, message, 'info');
    },

    /** 清除消息 */
    clearMessage(formId) {
        const form = this.forms[formId]?.form;
        if (!form) return;
        const messageEl = form.querySelector('.login-message') || form.querySelector('#message');
        if (messageEl) {
            messageEl.textContent = '';
            messageEl.classList.remove('show');
            messageEl.className = 'login-message';
        }
    },

    /* ============================================================
     * 5. 重置 / 动态创建
     * ============================================================ */

    /** 重置表单到初始状态 */
    reset(formId) {
        const form = this.forms[formId]?.form;
        if (!form) return;

        form.reset();
        this.clearMessage(formId);
        form.querySelectorAll('.login-error').forEach(el => el.remove());
        form.querySelectorAll('.candy-login-input').forEach(field => {
            field.style.borderColor = '';
        });
        this.resetAttempts(formId);
    },

    /**
     * 动态创建登录卡片（兼容旧 API）
     * @param {Object} options
     */
    create(options = {}) {
        const container = document.createElement('div');
        container.className = `login-card ${options.cardStyle ? `login-card-${options.cardStyle}` : 'login-card-1'}`;

        const header = document.createElement('h1');
        header.className = 'card-header';
        header.textContent = options.title || 'Secure Access';
        container.appendChild(header);

        const form = document.createElement('form');
        form.id = options.formId || 'loginForm';

        // 用户名
        const usernameGroup = document.createElement('div');
        usernameGroup.className = 'input-group';
        const usernameLabel = document.createElement('label');
        usernameLabel.className = 'input-label';
        usernameLabel.htmlFor = 'username';
        usernameLabel.textContent = 'Username';
        usernameGroup.appendChild(usernameLabel);

        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.id = 'username';
        usernameInput.name = 'username';
        usernameInput.className = 'candy-login-input';
        usernameInput.placeholder = options.usernamePlaceholder || 'Enter your username';
        usernameInput.required = true;
        usernameGroup.appendChild(usernameInput);
        form.appendChild(usernameGroup);

        // 密码
        const passwordGroup = document.createElement('div');
        passwordGroup.className = 'input-group';
        const passwordLabel = document.createElement('label');
        passwordLabel.className = 'input-label';
        passwordLabel.htmlFor = 'password';
        passwordLabel.textContent = 'Password';
        passwordGroup.appendChild(passwordLabel);

        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.id = 'password';
        passwordInput.name = 'password';
        passwordInput.className = 'candy-login-input';
        passwordInput.placeholder = options.passwordPlaceholder || 'Enter your password';
        passwordInput.required = true;
        passwordGroup.appendChild(passwordInput);
        form.appendChild(passwordGroup);

        // 登录按钮
        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'candy-login-btn';
        button.textContent = options.buttonText || 'Sign In';
        form.appendChild(button);

        // 加载器
        const loader = document.createElement('div');
        loader.className = 'loader';
        form.appendChild(loader);

        // 消息区
        const message = document.createElement('div');
        message.id = 'message';
        message.className = 'login-message';
        form.appendChild(message);

        container.appendChild(form);

        if (options.parent) {
            document.querySelector(options.parent).appendChild(container);
        }

        this.init({
            formId: form.id,
            onSubmit: options.onSubmit
        });

        return container;
    },

    /* ============================================================
     * 6. 记住密码 / 记住用户名 (localStorage)
     * ============================================================ */

    /** 获取指定表单在 localStorage 中的 key */
    _getStorageKey(formId, suffix) {
        return `${this._storagePrefix}${formId}_${suffix}`;
    },

    /** 通用安全写入 localStorage */
    _safeSet(key, value) {
        try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {
            console.warn('[CandyLogin] localStorage 写入失败', e);
        }
    },

    /** 通用安全读取 localStorage */
    _safeGet(key, parseJSON = false) {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return null;
            return parseJSON ? JSON.parse(raw) : raw;
        } catch (e) {
            return null;
        }
    },

    /** 通用安全删除 localStorage */
    _safeRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) { /* ignore */ }
    },

    /**
     * 启用 "记住密码" 功能
     * 在表单中查找复选框（#rememberMe），或自动注入一个
     */
    enableRememberMe(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;

        // 尝试查找已存在的记住密码复选框
        let checkbox = form.querySelector('#rememberMe') || form.querySelector('[name="rememberMe"]');
        if (!checkbox) {
            // 自动在密码输入框下方注入一行
            const wrapper = document.createElement('div');
            wrapper.className = 'remember-me-wrapper';
            wrapper.style.cssText = 'margin: 10px 0 16px; display: flex; align-items: center; font-size: 14px; color: #bbb;';

            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'rememberMe';
            checkbox.name = 'rememberMe';
            checkbox.style.cssText = 'margin-right: 8px; cursor: pointer;';

            const label = document.createElement('label');
            label.htmlFor = 'rememberMe';
            label.textContent = '记住密码';
            label.style.cssText = 'cursor: pointer; user-select: none;';

            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);

            // 插入到登录按钮之前
            const btn = form.querySelector('.candy-login-btn');
            if (btn) {
                form.insertBefore(wrapper, btn);
            } else {
                form.appendChild(wrapper);
            }
        }

        // 加载本地已保存的凭据
        this.loadCredentials(formId);
    },

    /**
     * 保存凭据到本地（仅当 rememberMe 勾选时保存密码）
     * 注：真实项目中密码不建议直接存储在 localStorage，这里仅做演示
     */
    saveCredentials(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;

        const usernameInput = form.querySelector('#username') || form.querySelector('[name="username"]');
        const passwordInput = form.querySelector('#password') || form.querySelector('[name="password"]');
        const rememberCheckbox = form.querySelector('#rememberMe') || form.querySelector('[name="rememberMe"]');

        if (!usernameInput) return;

        const username = usernameInput.value.trim();
        const shouldRemember = rememberCheckbox ? rememberCheckbox.checked : false;

        this._safeSet(this._getStorageKey(formId, 'username'), username);

        if (shouldRemember && passwordInput) {
            this._safeSet(this._getStorageKey(formId, 'password'), passwordInput.value);
            this._safeSet(this._getStorageKey(formId, 'remember'), '1');
        } else {
            // 未勾选则清除已保存的密码
            this._safeRemove(this._getStorageKey(formId, 'password'));
            this._safeRemove(this._getStorageKey(formId, 'remember'));
        }
    },

    /**
     * 从本地加载凭据，并填回表单
     */
    loadCredentials(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;

        const username = this._safeGet(this._getStorageKey(formId, 'username'));
        const password = this._safeGet(this._getStorageKey(formId, 'password'));
        const remembered = this._safeGet(this._getStorageKey(formId, 'remember')) === '1';

        const usernameInput = form.querySelector('#username') || form.querySelector('[name="username"]');
        const passwordInput = form.querySelector('#password') || form.querySelector('[name="password"]');
        const checkbox = form.querySelector('#rememberMe') || form.querySelector('[name="rememberMe"]');

        if (username && usernameInput) usernameInput.value = username;
        if (password && passwordInput && remembered) passwordInput.value = password;
        if (checkbox && remembered) checkbox.checked = true;
    },

    /**
     * 清除本地凭据
     */
    clearCredentials(formId) {
        this._safeRemove(this._getStorageKey(formId, 'username'));
        this._safeRemove(this._getStorageKey(formId, 'password'));
        this._safeRemove(this._getStorageKey(formId, 'remember'));

        // 同时清空表单对应字段
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;
        const usernameInput = form.querySelector('#username') || form.querySelector('[name="username"]');
        const passwordInput = form.querySelector('#password') || form.querySelector('[name="password"]');
        const checkbox = form.querySelector('#rememberMe') || form.querySelector('[name="rememberMe"]');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (checkbox) checkbox.checked = false;
    },

    /**
     * 启用 "记住用户名"（只保存用户名，不保存密码）
     */
    enableRememberUsername(formId) {
        this.loadRememberedUsername(formId);
    },

    /** 保存用户名到本地（不保存密码） */
    saveRememberedUsername(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;
        const usernameInput = form.querySelector('#username') || form.querySelector('[name="username"]');
        if (!usernameInput) return;
        this._safeSet(this._getStorageKey(formId, 'rememberedUsername'), usernameInput.value.trim());
    },

    /** 从本地加载记住的用户名并填回表单 */
    loadRememberedUsername(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;
        const usernameInput = form.querySelector('#username') || form.querySelector('[name="username"]');
        if (!usernameInput) return;
        const saved = this._safeGet(this._getStorageKey(formId, 'rememberedUsername'));
        if (saved) usernameInput.value = saved;
    },

    /* ============================================================
     * 7. 忘记密码
     * ============================================================ */

    /**
     * 启用忘记密码功能，在表单中添加 "忘记密码" 链接
     * @param {string} formId
     * @param {Object} options
     * @param {string} options.text - 链接文本
     * @param {Function} options.onSubmit - 提交邮箱时的回调
     */
    enableForgotPassword(formId, options = {}) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;

        // 如果已经存在链接则跳过
        if (form.querySelector('.candy-forgot-link')) return;

        const link = document.createElement('a');
        link.href = 'javascript:void(0)';
        link.className = 'candy-forgot-link';
        link.textContent = options.text || '忘记密码？';
        link.style.cssText = 'display: block; text-align: right; margin: 4px 0 16px; color: #6496ff; font-size: 13px; text-decoration: none; cursor: pointer;';

        link.addEventListener('click', () => {
            this.showForgotPassword(formId);
            if (typeof options.onClick === 'function') options.onClick();
        });

        // 插入到登录按钮之前
        const btn = form.querySelector('.candy-login-btn');
        if (btn) {
            form.insertBefore(link, btn);
        } else {
            form.appendChild(link);
        }

        // 保存配置
        formData.forgotPasswordOptions = options;
    },

    /**
     * 显示 "忘记密码" 弹窗（使用简单的模态）
     */
    showForgotPassword(formId) {
        const formData = this.forms[formId];
        if (!formData) return;

        // 如果已有弹窗则不再创建
        if (document.getElementById('candy-forgot-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'candy-forgot-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #1a1a2e; padding: 30px; border-radius: 12px;
            width: 90%; max-width: 380px; color: #e0e0e0;
            border: 1px solid rgba(100, 150, 255, 0.3);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
        `;

        box.innerHTML = `
            <h3 style="margin: 0 0 16px; font-size: 20px; color: #f8f8ff;">找回密码</h3>
            <p style="font-size: 13px; color: #bbb; margin-bottom: 16px;">请输入您的邮箱，我们将发送重置链接。</p>
            <input type="email" id="candy-forgot-email" placeholder="your@email.com"
                style="width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid #3a3a5a;
                       background: rgba(30, 30, 50, 0.75); color: #e0e0e0; font-size: 14px; box-sizing: border-box;">
            <div id="candy-forgot-msg" style="min-height: 20px; margin-top: 10px; font-size: 13px;"></div>
            <div style="display: flex; gap: 10px; margin-top: 14px;">
                <button id="candy-forgot-cancel"
                    style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #3a3a5a;
                           background: transparent; color: #bbb; cursor: pointer; font-size: 14px;">取消</button>
                <button id="candy-forgot-submit"
                    style="flex: 2; padding: 12px; border-radius: 8px; border: none;
                           background: linear-gradient(135deg, #6496ff, #bd4dff);
                           color: #fff; cursor: pointer; font-size: 14px; font-weight: 500;">发送重置链接</button>
            </div>
        `;

        modal.appendChild(box);
        document.body.appendChild(modal);

        // 事件绑定
        const closeModal = () => modal.remove();
        box.querySelector('#candy-forgot-cancel').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        box.querySelector('#candy-forgot-submit').addEventListener('click', () => {
            const email = box.querySelector('#candy-forgot-email').value.trim();
            const msgBox = box.querySelector('#candy-forgot-msg');

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                msgBox.style.color = '#f87171';
                msgBox.textContent = '请输入有效的邮箱地址';
                return;
            }

            msgBox.style.color = '#4ade80';
            msgBox.textContent = '处理中...';

            this.handleForgotPassword(formId, (result) => {
                if (result && result.success) {
                    msgBox.style.color = '#4ade80';
                    msgBox.textContent = result.message || '重置链接已发送至您的邮箱';
                    setTimeout(closeModal, 1500);
                } else {
                    msgBox.style.color = '#f87171';
                    msgBox.textContent = (result && result.message) || '发送失败，请稍后重试';
                }
            }, email);
        });
    },

    /**
     * 处理忘记密码
     * 如果用户配置了 onSubmit 则调用它，否则模拟成功
     */
    handleForgotPassword(formId, callback, email) {
        const formData = this.forms[formId];
        const options = formData && formData.forgotPasswordOptions;

        if (options && typeof options.onSubmit === 'function') {
            // 交给外部处理
            options.onSubmit(email, {
                success: (msg) => callback && callback({ success: true, message: msg }),
                error: (msg) => callback && callback({ success: false, message: msg })
            });
        } else {
            // 模拟请求
            setTimeout(() => {
                callback && callback({ success: true, message: '重置链接已发送至您的邮箱' });
            }, 1000);
        }
    },

    /* ============================================================
     * 8. 社交登录按钮
     * ============================================================ */

    /**
     * 社交平台基础配置
     */
    _socialProvidersMeta: {
        google: {
            name: 'Google',
            color: '#ea4335',
            icon: 'G'
        },
        facebook: {
            name: 'Facebook',
            color: '#1877f2',
            icon: 'f'
        },
        twitter: {
            name: 'Twitter',
            color: '#1da1f2',
            icon: 'T'
        },
        github: {
            name: 'GitHub',
            color: '#24292e',
            icon: '⌥'
        },
        wechat: {
            name: 'WeChat',
            color: '#07c160',
            icon: '微'
        }
    },

    /**
     * 启用社交登录
     * @param {string} formId
     * @param {Object} options
     * @param {string[]} options.providers - 启用的平台，如 ['google', 'wechat']
     * @param {Function} options.onLogin - 点击后的回调 (provider, {success, error})
     */
    enableSocialLogin(formId, options = {}) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;

        // 默认启用所有平台
        const providers = (options.providers && options.providers.length)
            ? options.providers.map(p => String(p).toLowerCase())
            : ['google', 'facebook', 'twitter', 'github', 'wechat'];

        formData.socialProviders = providers;
        formData.socialLoginOptions = options;

        // 如果已经有容器则跳过（避免重复）
        if (form.querySelector('.candy-social-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'candy-social-wrapper';
        wrapper.style.cssText = `
            margin-top: 20px; text-align: center;
        `;

        const divider = document.createElement('div');
        divider.style.cssText = `
            display: flex; align-items: center; font-size: 12px; color: #888; margin-bottom: 14px;
        `;
        divider.innerHTML = `
            <span style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></span>
            <span style="padding: 0 12px;">或使用第三方登录</span>
            <span style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></span>
        `;
        wrapper.appendChild(divider);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;';

        providers.forEach(provider => {
            const meta = this._socialProvidersMeta[provider];
            if (!meta) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `candy-social-btn candy-social-${provider}`;
            btn.title = `使用 ${meta.name} 登录`;
            btn.style.cssText = `
                width: 44px; height: 44px; border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.15);
                background: ${meta.color};
                color: #fff; font-size: 18px; font-weight: 600;
                cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;
            btn.textContent = meta.icon;

            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            });

            btn.addEventListener('click', () => {
                this.socialLogin(formId, provider);
            });

            btnRow.appendChild(btn);
        });

        wrapper.appendChild(btnRow);
        form.appendChild(wrapper);
    },

    /**
     * 执行社交登录
     * 如果配置了 onLogin 则交给外部，否则模拟请求
     */
    socialLogin(formId, provider, callback) {
        const formData = this.forms[formId];
        if (!formData) return;

        const options = formData.socialLoginOptions || {};
        this.showInfo(formId, `正在使用 ${this._socialProvidersMeta[provider]?.name || provider} 登录...`);

        if (typeof options.onLogin === 'function') {
            options.onLogin(provider, {
                success: (message) => {
                    this.resetAttempts(formId);
                    this.showSuccess(formId, message || '登录成功');
                    callback && callback({ success: true, provider });
                },
                error: (message) => {
                    this.showError(formId, message || '登录失败');
                    callback && callback({ success: false, provider });
                }
            });
        } else {
            // 默认为模拟登录
            setTimeout(() => {
                this.resetAttempts(formId);
                this.showSuccess(formId, `${this._socialProvidersMeta[provider]?.name || provider} 登录成功`);
                callback && callback({ success: true, provider });
            }, 1200);
        }
    },

    /* ============================================================
     * 9. 图形验证码
     * ============================================================ */

    /**
     * 启用图形验证码（Canvas 绘制）
     * @param {string} formId
     * @param {Object} options
     * @param {number} options.length - 验证码长度（默认 4）
     * @param {number} options.width - 画布宽度
     * @param {number} options.height - 画布高度
     * @param {boolean} options.caseSensitive - 是否区分大小写（默认 false）
     */
    enableCaptcha(formId, options = {}) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;

        // 防止重复创建
        if (form.querySelector('.candy-captcha-wrapper')) return;

        formData.captchaOptions = Object.assign({
            length: 4,
            width: 130,
            height: 44,
            caseSensitive: false
        }, options);

        const wrapper = document.createElement('div');
        wrapper.className = 'candy-captcha-wrapper';
        wrapper.style.cssText = 'margin-bottom: 16px; display: flex; gap: 10px; align-items: stretch;';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'captchaInput';
        input.name = 'captcha';
        input.className = 'candy-login-input';
        input.placeholder = '请输入验证码';
        input.required = true;
        input.style.cssText = 'flex: 1;';

        const canvasBox = document.createElement('div');
        canvasBox.style.cssText = `
            position: relative; border-radius: 8px; overflow: hidden;
            border: 1px solid #3a3a5a; background: rgba(30,30,50,0.75); cursor: pointer;
        `;
        canvasBox.title = '点击刷新验证码';

        const canvas = document.createElement('canvas');
        canvas.id = 'captchaCanvas';
        canvas.width = formData.captchaOptions.width;
        canvas.height = formData.captchaOptions.height;
        canvas.style.cssText = 'display: block;';

        canvasBox.appendChild(canvas);
        canvasBox.addEventListener('click', () => this.refreshCaptcha(formId));

        wrapper.appendChild(input);
        wrapper.appendChild(canvasBox);

        // 插入到登录按钮之前
        const btn = form.querySelector('.candy-login-btn');
        if (btn) {
            form.insertBefore(wrapper, btn);
        } else {
            form.appendChild(wrapper);
        }

        // 生成初始验证码
        this.generateCaptcha(formId);
    },

    /**
     * 生成验证码文本并绘制到 Canvas
     */
    generateCaptcha(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;
        const canvas = form.querySelector('#captchaCanvas');
        const opts = formData.captchaOptions;
        if (!canvas || !opts) return;

        const ctx = canvas.getContext('2d');
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < opts.length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        formData.captchaCode = code;

        // 绘制背景
        ctx.fillStyle = '#1e1e32';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制干扰线
        for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 150 + 50)}, ${Math.floor(Math.random() * 150 + 100)}, 255, 0.5)`;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        // 绘制干扰点
        for (let i = 0; i < 30; i++) {
            ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 255, 0.6)`;
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制文字
        const colors = ['#6496ff', '#bd4dff', '#4ade80', '#fbbf24', '#f87171'];
        const fontSize = Math.floor(canvas.height * 0.55);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';

        const charWidth = canvas.width / (code.length + 1);
        for (let i = 0; i < code.length; i++) {
            ctx.save();
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            const x = charWidth * (i + 1);
            const y = canvas.height / 2 + (Math.random() * 8 - 4);
            const angle = (Math.random() - 0.5) * 0.5;
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillText(code.charAt(i), -fontSize / 3, 0);
            ctx.restore();
        }
    },

    /**
     * 刷新验证码（重新生成）
     */
    refreshCaptcha(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const input = formData.form.querySelector('#captchaInput');
        if (input) input.value = '';
        this.generateCaptcha(formId);
    },

    /**
     * 验证用户输入的验证码
     * @returns {boolean}
     */
    validateCaptcha(formId, input) {
        const formData = this.forms[formId];
        if (!formData) return false;

        let userInput = input;
        // 如果未传入 input，则尝试从表单中获取
        if (typeof userInput !== 'string' || userInput === undefined) {
            const inputEl = formData.form.querySelector('#captchaInput');
            userInput = inputEl ? inputEl.value.trim() : '';
        } else {
            // 传入的也可能是 DOM 元素
            if (userInput instanceof HTMLInputElement) {
                userInput = userInput.value.trim();
            }
        }

        const expected = formData.captchaCode;
        if (!expected) return false;

        const opts = formData.captchaOptions || {};
        if (opts.caseSensitive) {
            return userInput === expected;
        }
        return String(userInput).toUpperCase() === expected.toUpperCase();
    },

    /* ============================================================
     * 10. 密码可见性切换
     * ============================================================ */

    /**
     * 启用密码可见性切换（眼睛图标）
     */
    enablePasswordToggle(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;
        const passwordInput = form.querySelector('#password') || form.querySelector('[name="password"]');
        if (!passwordInput) return;

        // 避免重复添加
        if (passwordInput.parentNode.querySelector('.candy-toggle-password')) return;

        // 调整输入框父容器使其支持相对定位的图标
        const parent = passwordInput.parentNode;
        parent.style.position = 'relative';

        passwordInput.style.paddingRight = '42px';

        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'candy-toggle-password';
        toggleBtn.title = '显示/隐藏密码';
        toggleBtn.style.cssText = `
            position: absolute; right: 12px; top: 50%;
            transform: translateY(-50%); cursor: pointer;
            color: #888; font-size: 16px; user-select: none;
            padding: 4px 6px;
        `;
        // 初始为 "闭眼"
        toggleBtn.textContent = '👁';

        toggleBtn.addEventListener('click', () => this.togglePasswordVisibility(formId));

        parent.appendChild(toggleBtn);
    },

    /**
     * 切换密码框的显示/隐藏状态
     */
    togglePasswordVisibility(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        const form = formData.form;
        const passwordInput = form.querySelector('#password') || form.querySelector('[name="password"]');
        const toggleBtn = form.querySelector('.candy-toggle-password');
        if (!passwordInput) return;

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            if (toggleBtn) toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            if (toggleBtn) toggleBtn.textContent = '👁';
        }
    },

    /* ============================================================
     * 11. 登录尝试次数限制 / 账户锁定
     * ============================================================ */

    /**
     * 设置最大尝试次数
     */
    setMaxAttempts(formId, maxAttempts) {
        const formData = this.forms[formId];
        if (!formData) return;
        formData.maxAttempts = Math.max(1, parseInt(maxAttempts, 10) || 5);
    },

    /**
     * 获取当前尝试次数
     */
    getAttempts(formId) {
        const formData = this.forms[formId];
        return formData ? formData.attempts : 0;
    },

    /**
     * 内部方法：增加一次尝试次数，达到上限时锁定
     */
    _incrementAttempts(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        formData.attempts += 1;
        if (formData.attempts >= formData.maxAttempts && !formData.locked) {
            // 默认锁定 5 分钟
            this.lockAccount(formId, 5 * 60 * 1000);
        }
    },

    /**
     * 是否被锁定
     */
    isLocked(formId) {
        const formData = this.forms[formId];
        if (!formData) return false;
        if (!formData.locked) return false;
        // 若已超过锁定时间则自动解锁
        if (formData.lockUntil > 0 && Date.now() > formData.lockUntil) {
            this.unlockAccount(formId);
            return false;
        }
        return true;
    },

    /**
     * 重置尝试次数
     */
    resetAttempts(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        formData.attempts = 0;
    },

    /**
     * 锁定账户一段时间（毫秒）
     */
    lockAccount(formId, duration) {
        const formData = this.forms[formId];
        if (!formData) return;
        formData.locked = true;
        formData.lockDuration = duration || 5 * 60 * 1000;
        formData.lockUntil = Date.now() + formData.lockDuration;

        // 禁用登录按钮
        const btn = formData.form.querySelector('.candy-login-btn');
        if (btn) {
            btn.dataset.originalText = btn.textContent;
            btn.disabled = true;
        }

        // 如果已有计时器则先清除
        if (formData._lockTimer) {
            clearInterval(formData._lockTimer);
        }

        // 每秒更新一次倒计时消息
        this.showLockedMessage(formId);
        formData._lockTimer = setInterval(() => {
            if (!this.isLocked(formId)) {
                clearInterval(formData._lockTimer);
                formData._lockTimer = null;
                return;
            }
            this.showLockedMessage(formId);
        }, 1000);
    },

    /**
     * 解锁账户
     */
    unlockAccount(formId) {
        const formData = this.forms[formId];
        if (!formData) return;
        formData.locked = false;
        formData.lockUntil = 0;
        formData.lockDuration = 0;
        formData.attempts = 0;

        if (formData._lockTimer) {
            clearInterval(formData._lockTimer);
            formData._lockTimer = null;
        }

        // 恢复按钮
        const btn = formData.form.querySelector('.candy-login-btn');
        if (btn) {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
        }

        // 如果正在显示锁定消息，清除
        const msg = formData.form.querySelector('.login-message') || formData.form.querySelector('#message');
        if (msg && msg.textContent.includes('锁定')) {
            this.clearMessage(formId);
        }
    },

    /**
     * 显示锁定消息（含剩余时间）
     */
    showLockedMessage(formId) {
        const remaining = this.getLockRemainingTime(formId);
        if (remaining <= 0) {
            this.showInfo(formId, '账户已解锁，请重新尝试');
            return;
        }
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeStr = minutes > 0
            ? `${minutes} 分 ${seconds} 秒`
            : `${seconds} 秒`;
        this.showError(formId, `账户已锁定，请在 ${timeStr} 后重试`);
    },

    /**
     * 获取剩余锁定时间（毫秒）
     */
    getLockRemainingTime(formId) {
        const formData = this.forms[formId];
        if (!formData || !formData.locked || !formData.lockUntil) return 0;
        return Math.max(0, formData.lockUntil - Date.now());
    },

    /* ============================================================
     * 12. 增强的表单验证
     * ============================================================ */

    /**
     * 验证用户名规则（3-20位字母、数字、下划线）
     */
    validateUsername(formId) {
        const formData = this.forms[formId];
        if (!formData) return false;
        const input = formData.form.querySelector('#username') || formData.form.querySelector('[name="username"]');
        if (!input) return false;
        const value = input.value.trim();
        const regex = /^[A-Za-z0-9_]{3,20}$/;

        if (!value) {
            this.showFieldError(input, '用户名不能为空');
            return false;
        }
        if (!regex.test(value)) {
            this.showFieldError(input, '用户名为 3-20 位字母、数字或下划线');
            return false;
        }
        this.clearFieldError(input);
        return true;
    },

    /**
     * 验证邮箱格式
     */
    validateEmail(formId) {
        const formData = this.forms[formId];
        if (!formData) return false;
        const input = formData.form.querySelector('#email') || formData.form.querySelector('[name="email"]') ||
                       formData.form.querySelector('input[type="email"]');
        if (!input) return false;
        const value = input.value.trim();
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!value) {
            this.showFieldError(input, '邮箱不能为空');
            return false;
        }
        if (!regex.test(value)) {
            this.showFieldError(input, '请输入有效的邮箱地址');
            return false;
        }
        this.clearFieldError(input);
        return true;
    },

    /**
     * 检测密码强度
     * 强度等级：0(空) / 1(弱) / 2(中) / 3(强) / 4(非常强)
     * @returns {Object} { level, description, valid }
     */
    validatePasswordStrength(formId) {
        const formData = this.forms[formId];
        const result = { level: 0, description: '', valid: false };
        if (!formData) return result;

        const input = formData.form.querySelector('#password') || formData.form.querySelector('[name="password"]');
        if (!input) return result;

        const value = input.value;
        if (!value) {
            result.description = '密码不能为空';
            return result;
        }

        let level = 0;
        if (value.length >= 6) level++;
        if (value.length >= 10) level++;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) level++;
        if (/\d/.test(value)) level++;
        if (/[^A-Za-z0-9]/.test(value)) level++;

        // 合并到 1-4 区间
        if (level <= 1) result.level = 1;
        else if (level <= 2) result.level = 2;
        else if (level <= 3) result.level = 3;
        else result.level = 4;

        const descs = ['', '弱', '中等', '强', '非常强'];
        result.description = `密码强度：${descs[result.level]}`;
        result.valid = value.length >= 6 && result.level >= 2;

        // 如验证失败则显示错误
        if (!result.valid) {
            this.showFieldError(input, '密码至少 6 位，建议包含大小写字母和数字');
        } else {
            this.clearFieldError(input);
        }

        return result;
    },

    /**
     * 一次显示所有验证错误（在消息区域汇总提示）
     */
    showValidationErrors(formId) {
        const formData = this.forms[formId];
        if (!formData) return;

        const errors = [];
        if (!this.validateUsername(formId)) errors.push('用户名');
        if (!this.validateEmail(formId)) errors.push('邮箱');
        const pwd = this.validatePasswordStrength(formId);
        if (!pwd.valid) errors.push('密码');

        if (errors.length === 0) {
            this.showSuccess(formId, '表单验证通过');
        } else {
            this.showError(formId, `请检查：${errors.join('、')}`);
        }
    }

};

/* ============================================================
 * DOM 就绪后自动初始化示例表单
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // 只在存在登录表单时才初始化，避免报错
    if (document.getElementById('loginForm')) {
        CandyLogin.init({ formId: 'loginForm' });
    }
});
