/**
 * CandyInput - 糖果风格输入框增强组件
 * 提供实时验证、自动补全、字符计数、密码可见性切换等多种增强功能
 */
const CandyInput = {
    // 存储验证规则
    _validationRules: new Map(),
    // 存储自动补全数据
    _autocompleteData: new Map(),
    // 存储字符计数元素
    _charCountElements: new Map(),
    // 存储密码可见性切换按钮
    _passwordToggleBtns: new Map(),
    // 存储清除按钮
    _clearButtons: new Map(),
    // 存储前缀/后缀元素
    _prefixSuffixElements: new Map(),

    /**
     * 初始化组件，绑定基础事件
     */
    init() {
        this.bindEvents();
    },

    /**
     * 绑定基础事件监听
     */
    bindEvents() {
        document.querySelectorAll('.candy-input').forEach(input => {
            // 聚焦事件
            input.addEventListener('focus', () => {
                input.classList.add('candy-input-focused');
                input.dispatchEvent(new CustomEvent('candy-input-focus', { bubbles: true }));
            });

            // 失去焦点事件
            input.addEventListener('blur', () => {
                input.classList.remove('candy-input-focused');
                // 失去焦点时执行验证
                this._validateInput(input);
                input.dispatchEvent(new CustomEvent('candy-input-blur', {
                    detail: { value: input.value },
                    bubbles: true
                }));
            });

            // 输入事件
            input.addEventListener('input', () => {
                // 实时验证
                this._validateInput(input);
                // 更新字符计数
                this._updateCharCount(input);
                // 更新清除按钮显示状态
                this._updateClearButton(input);
                // 更新自动补全
                this._updateAutocomplete(input);
                input.dispatchEvent(new CustomEvent('candy-input-change', {
                    detail: { value: input.value },
                    bubbles: true
                }));
            });

            // 键盘事件 - 支持自动补全导航
            input.addEventListener('keydown', (e) => {
                this._handleAutocompleteKeydown(e, input);
            });
        });
    },

    // ==================== 动态管理方法 ====================

    /**
     * 获取输入框的值
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {string} 输入框的值
     */
    getValue(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        return input ? input.value : '';
    },

    /**
     * 设置输入框的值
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {string} value - 要设置的值
     */
    setValue(selector, value) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.value = value;
            input.dispatchEvent(new CustomEvent('input', { bubbles: true }));
            input.dispatchEvent(new CustomEvent('change', { bubbles: true }));
        }
    },

    /**
     * 清空输入框
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    clear(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.value = '';
            this.clearError(input);
            this._updateCharCount(input);
            this._updateClearButton(input);
            input.dispatchEvent(new CustomEvent('input', { bubbles: true }));
            input.dispatchEvent(new CustomEvent('change', { bubbles: true }));
        }
    },

    /**
     * 获取输入框焦点
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    focus(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) input.focus();
    },

    /**
     * 使输入框失去焦点
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    blur(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) input.blur();
    },

    /**
     * 禁用输入框
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    disable(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.disabled = true;
            input.classList.add('candy-input-disabled');
        }
    },

    /**
     * 启用输入框
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    enable(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.disabled = false;
            input.classList.remove('candy-input-disabled');
        }
    },

    // ==================== 实时验证功能 ====================

    /**
     * 内置验证规则
     */
    _builtInValidators: {
        // 必填验证
        required: (value, rule) => {
            if (!value || value.trim() === '') {
                return rule.message || '此字段为必填项';
            }
            return null;
        },
        // 邮箱验证
        email: (value, rule) => {
            if (!value) return null;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return rule.message || '请输入有效的邮箱地址';
            }
            return null;
        },
        // 手机号验证（中国大陆）
        phone: (value, rule) => {
            if (!value) return null;
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(value)) {
                return rule.message || '请输入有效的手机号码';
            }
            return null;
        },
        // URL验证
        url: (value, rule) => {
            if (!value) return null;
            try {
                new URL(value);
                return null;
            } catch {
                return rule.message || '请输入有效的网址';
            }
        },
        // 最小长度验证
        minLength: (value, rule) => {
            if (!value) return null;
            if (value.length < rule.value) {
                return rule.message || `至少需要 ${rule.value} 个字符`;
            }
            return null;
        },
        // 最大长度验证
        maxLength: (value, rule) => {
            if (!value) return null;
            if (value.length > rule.value) {
                return rule.message || `最多只能输入 ${rule.value} 个字符`;
            }
            return null;
        },
        // 正则表达式验证
        pattern: (value, rule) => {
            if (!value) return null;
            const regex = typeof rule.value === 'string' ? new RegExp(rule.value) : rule.value;
            if (!regex.test(value)) {
                return rule.message || '格式不正确';
            }
            return null;
        },
        // 自定义验证函数
        custom: (value, rule) => {
            if (typeof rule.value === 'function') {
                return rule.value(value);
            }
            return null;
        }
    },

    /**
     * 添加验证规则
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Array|Object} rules - 验证规则数组或单个规则对象
     * @example
     * // 添加多个规则
     * CandyInput.addValidation('#username', [
     *     { type: 'required', message: '用户名不能为空' },
     *     { type: 'minLength', value: 3, message: '用户名至少3位' }
     * ]);
     * // 添加单个规则
     * CandyInput.addValidation('#email', { type: 'email' });
     */
    addValidation(selector, rules) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        // 规范化规则格式
        const normalizedRules = Array.isArray(rules) ? rules : [rules];
        this._validationRules.set(input, normalizedRules);
    },

    /**
     * 移除验证规则
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    removeValidation(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            this._validationRules.delete(input);
        }
    },

    /**
     * 执行验证
     * @param {HTMLElement} input - 输入框元素
     * @returns {Object} 验证结果 { valid: boolean, message: string }
     */
    _validateInput(input) {
        const rules = this._validationRules.get(input);
        if (!rules || rules.length === 0) {
            return { valid: true };
        }

        const value = input.value;

        for (const rule of rules) {
            const validator = this._builtInValidators[rule.type];
            if (validator) {
                const error = validator(value, rule);
                if (error) {
                    this.showError(input, error);
                    return { valid: false, message: error };
                }
            }
        }

        this.clearError(input);
        return { valid: true };
    },

    /**
     * 手动验证（不自动显示错误）
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {Object} 验证结果
     */
    validate(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return { valid: false, message: '输入框不存在' };
        return this._validateInput(input);
    },

    /**
     * 显示错误信息
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {string} message - 错误信息
     */
    showError(selector, message) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        const wrapper = input.closest('.candy-input-wrapper') || input.parentElement;
        let errorEl = wrapper.querySelector('.candy-input-error');

        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'candy-input-error';
            wrapper.appendChild(errorEl);
        }

        errorEl.textContent = message;
        input.classList.add('candy-input-error');
        input.classList.remove('candy-input-valid');

        // 触发震动效果
        this._shakeAnimation(input);
    },

    /**
     * 清除错误信息
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    clearError(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        const wrapper = input.closest('.candy-input-wrapper') || input.parentElement;
        const errorEl = wrapper.querySelector('.candy-input-error');

        if (errorEl) {
            errorEl.remove();
        }

        input.classList.remove('candy-input-error');

        // 如果验证通过，添加有效样式
        if (input.value && this._validationRules.has(input)) {
            input.classList.add('candy-input-valid');
        }
    },

    /**
     * 震动动画效果（验证失败时）
     * @param {HTMLElement} input - 输入框元素
     */
    _shakeAnimation(input) {
        input.classList.add('candy-input-shake');
        setTimeout(() => {
            input.classList.remove('candy-input-shake');
        }, 500);
    },

    // ==================== 自动补全功能 ====================

    /**
     * 启用自动补全
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Array|Function} suggestions - 建议数据数组或获取数据的函数
     * @param {Object} options - 配置选项
     * @param {number} options.maxVisible - 最大显示数量，默认10
     * @param {Function} options.onSelect - 选择建议后的回调
     */
    enableAutocomplete(selector, suggestions, options = {}) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        this._autocompleteData.set(input, {
            suggestions: typeof suggestions === 'function' ? suggestions : () => suggestions,
            options
        });

        // 创建自动补全下拉容器
        let dropdown = input.parentElement.querySelector('.candy-input-autocomplete');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'candy-input-autocomplete';
            input.parentElement.appendChild(dropdown);
        }

        this._autocompleteDropdown = dropdown;
        this._autocompleteCurrentIndex = -1;
    },

    /**
     * 禁用自动补全
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    disableAutocomplete(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            this._autocompleteData.delete(input);
            const dropdown = input.parentElement.querySelector('.candy-input-autocomplete');
            if (dropdown) dropdown.remove();
        }
    },

    /**
     * 更新自动补全列表
     * @param {HTMLElement} input - 输入框元素
     */
    _updateAutocomplete(input) {
        const data = this._autocompleteData.get(input);
        if (!data) return;

        const value = input.value.toLowerCase().trim();
        const suggestions = data.suggestions() || [];
        const dropdown = input.parentElement.querySelector('.candy-input-autocomplete');

        if (!dropdown) return;

        // 过滤匹配的建议
        const filtered = suggestions.filter(item => {
            const text = typeof item === 'string' ? item : item.text || item.label || String(item);
            return text.toLowerCase().includes(value);
        }).slice(0, data.options.maxVisible || 10);

        if (filtered.length === 0 || value.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        // 渲染下拉列表
        dropdown.innerHTML = '';
        this._autocompleteCurrentIndex = -1;

        filtered.forEach((item, index) => {
            const text = typeof item === 'string' ? item : item.text || item.label || String(item);
            const value_ = typeof item === 'object' ? (item.value || text) : text;

            const el = document.createElement('div');
            el.className = 'candy-input-autocomplete-item';
            el.innerHTML = this._highlightMatch(text, value);
            el.dataset.value = value_;
            el.dataset.index = index;

            el.addEventListener('click', () => {
                this._selectAutocomplete(input, value_);
            });

            dropdown.appendChild(el);
        });

        dropdown.style.display = 'block';
    },

    /**
     * 高亮匹配文字
     * @param {string} text - 原始文本
     * @param {string} query - 查询关键字
     * @returns {string} 高亮后的HTML
     */
    _highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="candy-input-highlight">$1</mark>');
    },

    /**
     * 选择自动补全项
     * @param {HTMLElement} input - 输入框元素
     * @param {string} value - 选中的值
     */
    _selectAutocomplete(input, value) {
        input.value = value;
        this.clearError(input);
        const dropdown = input.parentElement.querySelector('.candy-input-autocomplete');
        if (dropdown) dropdown.style.display = 'none';

        const data = this._autocompleteData.get(input);
        if (data && data.options.onSelect) {
            data.options.onSelect(value);
        }

        input.dispatchEvent(new CustomEvent('candy-input-autocomplete-select', {
            detail: { value },
            bubbles: true
        }));
    },

    /**
     * 处理自动补全键盘导航
     * @param {Event} e - 键盘事件
     * @param {HTMLElement} input - 输入框元素
     */
    _handleAutocompleteKeydown(e, input) {
        const dropdown = input.parentElement.querySelector('.candy-input-autocomplete');
        if (!dropdown || dropdown.style.display === 'none') return;

        const items = dropdown.querySelectorAll('.candy-input-autocomplete-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this._autocompleteCurrentIndex = Math.min(
                    this._autocompleteCurrentIndex + 1,
                    items.length - 1
                );
                this._updateAutocompleteHighlight(items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._autocompleteCurrentIndex = Math.max(
                    this._autocompleteCurrentIndex - 1,
                    0
                );
                this._updateAutocompleteHighlight(items);
                break;
            case 'Enter':
                e.preventDefault();
                if (this._autocompleteCurrentIndex >= 0 && items[this._autocompleteCurrentIndex]) {
                    const selectedValue = items[this._autocompleteCurrentIndex].dataset.value;
                    this._selectAutocomplete(input, selectedValue);
                }
                break;
            case 'Escape':
                dropdown.style.display = 'none';
                this._autocompleteCurrentIndex = -1;
                break;
        }
    },

    /**
     * 更新自动补全高亮
     * @param {NodeList} items - 自动补全项元素列表
     */
    _updateAutocompleteHighlight(items) {
        items.forEach((item, index) => {
            item.classList.toggle('candy-input-autocomplete-item-active', index === this._autocompleteCurrentIndex);
        });
    },

    // ==================== 字符计数功能 ====================

    /**
     * 显示字符计数
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {number} maxLength - 最大字符数，0表示不限制
     */
    showCharCount(selector, maxLength = 0) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        const wrapper = input.closest('.candy-input-wrapper') || input.parentElement;
        let counter = wrapper.querySelector('.candy-input-counter');

        if (!counter) {
            counter = document.createElement('div');
            counter.className = 'candy-input-counter';
            wrapper.appendChild(counter);
        }

        this._charCountElements.set(input, { counter, maxLength });
        this._updateCharCount(input);
    },

    /**
     * 更新字符计数显示
     * @param {HTMLElement} input - 输入框元素
     */
    _updateCharCount(input) {
        const data = this._charCountElements.get(input);
        if (!data) return;

        const length = input.value.length;
        const { counter, maxLength } = data;

        if (maxLength > 0) {
            counter.textContent = `${length}/${maxLength}`;
            counter.classList.toggle('candy-input-counter-warning', length > maxLength);
            counter.classList.toggle('candy-input-counter-danger', length > maxLength * 1.1);
        } else {
            counter.textContent = length;
        }
    },

    /**
     * 移除字符计数
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    removeCharCount(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        const data = this._charCountElements.get(input);
        if (data) {
            data.counter.remove();
            this._charCountElements.delete(input);
        }
    },

    // ==================== 密码功能增强 ====================

    /**
     * 切换密码可见性
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Object} options - 配置选项
     * @param {string} options.toggleText - 切换按钮文本
     * @param {boolean} options.syncGroup - 是否同步切换同组密码字段
     * @param {string} options.groupName - 同步组名称
     */
    togglePasswordVisibility(selector, options = {}) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input || input.type !== 'password' && input.type !== 'text') return;

        const wrapper = input.closest('.candy-input-wrapper') || input.parentElement;
        let toggleBtn = wrapper.querySelector('.candy-input-password-toggle');

        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'candy-input-password-toggle';
            toggleBtn.innerHTML = '👁';
            toggleBtn.setAttribute('aria-label', '切换密码可见性');
            wrapper.appendChild(toggleBtn);

            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggleBtn.innerHTML = isPassword ? '🙈' : '👁';
                toggleBtn.classList.toggle('candy-input-password-toggle-active', isPassword);

                // 同步切换同组密码字段
                if (options.syncGroup && options.groupName) {
                    this._syncPasswordGroup(options.groupName, isPassword ? 'text' : 'password');
                }
            });
        }

        this._passwordToggleBtns.set(input, { toggleBtn, options });
    },

    /**
     * 同步切换同组密码字段
     * @param {string} groupName - 组名称
     * @param {string} type - 类型 'password' 或 'text'
     */
    _syncPasswordGroup(groupName, type) {
        const groupInputs = document.querySelectorAll(`[data-password-group="${groupName}"]`);
        groupInputs.forEach(input => {
            input.type = type;
            const btnData = this._passwordToggleBtns.get(input);
            if (btnData) {
                btnData.toggleBtn.innerHTML = type === 'password' ? '👁' : '🙈';
                btnData.toggleBtn.classList.toggle('candy-input-password-toggle-active', type === 'text');
            }
        });
    },

    /**
     * 为密码字段添加同步组
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {string} groupName - 组名称
     */
    setPasswordGroup(selector, groupName) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.dataset.passwordGroup = groupName;
        }
    },

    // ==================== 清除按钮 ====================

    /**
     * 显示清除按钮
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Function} options.onClear - 清除前的回调，返回false可阻止清除
     */
    showClearButton(selector, options = {}) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        const wrapper = input.closest('.candy-input-wrapper') || input.parentElement;
        let clearBtn = wrapper.querySelector('.candy-input-clear');

        if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'candy-input-clear';
            clearBtn.innerHTML = '✕';
            clearBtn.setAttribute('aria-label', '清除输入');
            wrapper.appendChild(clearBtn);

            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (options.onClear) {
                    const result = options.onClear();
                    if (result === false) return;
                }
                this.clear(input);
                input.focus();
            });
        }

        this._clearButtons.set(input, { clearBtn, options });
        this._updateClearButton(input);
    },

    /**
     * 更新清除按钮显示状态
     * @param {HTMLElement} input - 输入框元素
     */
    _updateClearButton(input) {
        const data = this._clearButtons.get(input);
        if (!data) return;

        const hasValue = input.value.length > 0;
        data.clearBtn.style.display = hasValue ? 'flex' : 'none';
    },

    /**
     * 移除清除按钮
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    removeClearButton(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        const data = this._clearButtons.get(input);
        if (data) {
            data.clearBtn.remove();
            this._clearButtons.delete(input);
        }
    },

    // ==================== 前缀/后缀支持 ====================

    /**
     * 创建带有前缀/后缀的输入框
     * @param {Object} options - 配置选项
     * @param {string|HTMLElement} options.prefix - 前缀内容（图标类名或文字）
     * @param {string|HTMLElement} options.suffix - 后缀内容
     * @returns {HTMLElement} 包装器元素
     */
    create(options = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'candy-input-wrapper';

        // 处理前缀
        if (options.prefix) {
            const prefixEl = document.createElement('span');
            prefixEl.className = 'candy-input-addon candy-input-prefix';
            if (typeof options.prefix === 'string' && options.prefix.startsWith('fa-')) {
                prefixEl.innerHTML = `<i class="fas ${options.prefix}"></i>`;
            } else {
                prefixEl.textContent = options.prefix;
            }
            wrapper.appendChild(prefixEl);
        }

        // 创建输入框
        const input = document.createElement('input');
        input.type = options.type || 'text';
        input.className = `candy-input candy-input-${options.style || 1}`;
        input.placeholder = options.placeholder || '';
        input.value = options.value || '';

        if (options.id) input.id = options.id;
        if (options.name) input.name = options.name;
        if (options.maxLength) input.maxLength = options.maxLength;
        if (options.disabled) {
            input.disabled = true;
            input.classList.add('candy-input-disabled');
        }

        // 绑定事件回调
        if (options.onFocus) {
            input.addEventListener('focus', options.onFocus);
        }
        if (options.onBlur) {
            input.addEventListener('blur', options.onBlur);
        }
        if (options.onChange) {
            input.addEventListener('input', (e) => {
                options.onChange(e.target.value, e);
            });
        }
        if (options.onInput) {
            input.addEventListener('input', options.onInput);
        }

        // 应用样式类
        if (options.prefix) input.classList.add('candy-input-has-prefix');
        if (options.suffix) input.classList.add('candy-input-has-suffix');

        wrapper.appendChild(input);

        // 处理后缀
        if (options.suffix) {
            const suffixEl = document.createElement('span');
            suffixEl.className = 'candy-input-addon candy-input-suffix';
            if (typeof options.suffix === 'string' && options.suffix.startsWith('fa-')) {
                suffixEl.innerHTML = `<i class="fas ${options.suffix}"></i>`;
            } else {
                suffixEl.textContent = options.suffix;
            }
            wrapper.appendChild(suffixEl);
        }

        // 根据配置启用附加功能
        if (options.maxLength && options.maxLength > 0) {
            this.showCharCount(input, options.maxLength);
        }

        if (options.clearButton) {
            this.showClearButton(input, options.clearButtonOptions || {});
        }

        if (options.autocomplete) {
            this.enableAutocomplete(input, options.autocomplete, options.autocompleteOptions || {});
        }

        if (options.type === 'password' && options.togglePassword) {
            this.togglePasswordVisibility(input, options.passwordOptions || {});
        }

        if (options.validation) {
            this.addValidation(input, options.validation);
        }

        // 打字机效果
        if (options.typewriter) {
            this.enableTypewriter(input, options.typewriterSpeed || 50);
        }

        // 添加到页面
        if (options.parent) {
            document.querySelector(options.parent).appendChild(wrapper);
        }

        // 存储前缀/后缀信息
        this._prefixSuffixElements.set(input, { prefix: options.prefix, suffix: options.suffix });

        return wrapper;
    },

    // ==================== 输入动画 ====================

    /**
     * 启用打字机效果
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {number} speed - 每个字符的延迟毫秒数
     */
    enableTypewriter(selector, speed = 50) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;

        input.classList.add('candy-input-typewriter');

        const originalSetValue = this.setValue;
        const self = this;

        input._typewriterEnabled = true;
        input._typewriterSpeed = speed;

        // 存储原始的setValue
        input._originalSetValue = function(value) {
            if (!this._typewriterEnabled) {
                originalSetValue(this, value);
                return;
            }

            this.value = '';
            let index = 0;
            const chars = value.split('');

            const typeChar = () => {
                if (index < chars.length) {
                    this.value += chars[index];
                    this.dispatchEvent(new CustomEvent('input', { bubbles: true }));
                    index++;
                    setTimeout(typeChar, this._typewriterSpeed);
                }
            };

            typeChar();
        };
    },

    /**
     * 禁用打字机效果
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    disableTypewriter(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.classList.remove('candy-input-typewriter');
            input._typewriterEnabled = false;
        }
    },

    /**
     * 聚焦缩放动画（CSS配合）
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    enableFocusScale(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.classList.add('candy-input-focus-scale');
        }
    },

    /**
     * 禁用聚焦缩放动画
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    disableFocusScale(selector) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (input) {
            input.classList.remove('candy-input-focus-scale');
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyInput.init();
});

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyInput;
}
