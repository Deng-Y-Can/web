/**
 * CandyForm - 增强版表单组件
 * 提供表单验证、数据管理、文件上传、多步骤表单、密码强度等完整功能
 *
 * 功能模块：
 *   1. 基础功能 - init, getFormData, validateForm, validateField, reset, disable, enable
 *   2. 验证增强 - 自定义验证器、异步验证、验证摘要
 *   3. 自定义规则 - equalTo, notEqualTo, contains, startsWith, endsWith, isNumeric,
 *                   isInteger, isDate, isTime, isStrongPassword, matchPattern
 *   4. 文件上传 - 类型/大小限制、多文件、进度显示
 *   5. 草稿保存 - localStorage 自动/手动保存
 *   6. 多步骤表单 - 步骤导航、进度指示器
 *   7. 字段依赖 - 基于条件显示/隐藏
 *   8. 密码强度 - 强度指示器
 *   9. 数据序列化 - JSON 导入/导出
 *  10. 字段状态 - dirty/clean 追踪
 *  11. 事件系统 - 回调事件
 *  12. 动态创建 - create, createField
 */
const CandyForm = {

    // ===== 内部状态存储 =====

    /** 所有管理中的表单状态 */
    forms: [],

    /** 自定义验证器集合：{ selector: [validatorFn, ...] } */
    customValidators: {},

    /** 异步验证器集合：{ fieldSelector: asyncFn } */
    asyncValidators: {},

    /** 字段依赖关系集合 */
    dependencies: [],

    /** 草稿配置：{ selector: { key, interval, timer } } */
    draftConfigs: {},

    /** 步骤表单配置 */
    stepForms: {},

    /** 文件上传配置 */
    fileUploadConfigs: {},

    /** 密码强度配置 */
    passwordStrengthConfigs: {},

    /** 字段脏状态：{ fieldSelector: boolean } */
    dirtyFields: {},

    /** 事件回调：{ selector: { eventName: [callback, ...] } } */
    eventCallbacks: {},

    /** 原始字段值（用于 dirty 追踪） */
    originalValues: {},

    // =========================================================================
    // 一、基础功能
    // =========================================================================

    /**
     * 初始化 CandyForm，绑定所有 .candy-form 的事件
     */
    init() {
        this.bindEvents();
        this.triggerEvent(document, 'candy-form-init', {});
    },

    /**
     * 绑定事件监听器：submit、blur、input、change 等
     */
    bindEvents() {
        const forms = document.querySelectorAll('.candy-form');
        forms.forEach(form => {
            // 表单提交拦截
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(form);
            });

            // 遍历所有输入字段，绑定实时验证与脏状态追踪
            form.querySelectorAll('input, select, textarea').forEach(field => {
                // 记录初始值，用于 dirty 比较
                const key = this.getFieldKey(field);
                this.originalValues[key] = this.getFieldValue(field);

                // 失焦时验证
                field.addEventListener('blur', () => {
                    this.validateField(field);
                });

                // 输入时清除错误
                field.addEventListener('input', () => {
                    this.clearFieldError(field);
                    this.handleFieldChange(field);
                });

                // 改变时更新 dirty 状态
                field.addEventListener('change', () => {
                    this.handleFieldChange(field);
                });
            });

            // 触发表单就绪事件
            setTimeout(() => {
                this.triggerEvent(form, 'candy-form-ready', { form });
            }, 0);
        });
    },

    /**
     * 处理字段变化：更新 dirty 状态、触发回调
     */
    handleFieldChange(field) {
        const key = this.getFieldKey(field);
        const original = this.originalValues[key];
        const current = this.getFieldValue(field);
        const isDirty = JSON.stringify(original) !== JSON.stringify(current);

        if (isDirty) {
            this.markDirty(field);
        } else {
            this.markClean(field);
        }

        // 触发字段变化事件
        this.triggerEvent(field, 'candy-field-change', { field, value: current, isDirty });

        // 字段变化时检查依赖关系
        this.checkDependencies(field);
    },

    /**
     * 获取字段的唯一标识键
     */
    getFieldKey(field) {
        return field.id || field.name || field.getAttribute('data-candy-key');
    },

    /**
     * 获取字段的值（兼容 checkbox/radio/select-multiple）
     */
    getFieldValue(field) {
        if (field.type === 'checkbox') {
            if (field.name && field.name.endsWith('[]')) {
                const form = field.closest('form') || document;
                const values = [];
                form.querySelectorAll(`input[name="${field.name}"]:checked`).forEach(cb => {
                    values.push(cb.value);
                });
                return values;
            }
            return field.checked ? field.value : '';
        }
        if (field.type === 'radio') {
            const form = field.closest('form') || document;
            const checked = form.querySelector(`input[name="${field.name}"]:checked`);
            return checked ? checked.value : '';
        }
        if (field.tagName === 'SELECT' && field.multiple) {
            return Array.from(field.selectedOptions).map(opt => opt.value);
        }
        return field.value;
    },

    /**
     * 统一获取表单元素（支持字符串选择器或 DOM 元素）
     */
    resolveElement(selector) {
        if (!selector) return null;
        if (typeof selector === 'string') return document.querySelector(selector);
        return selector;
    },

    /**
     * 处理表单提交：收集数据、验证、触发事件
     */
    handleSubmit(form) {
        const data = this.getFormData(form);

        // 触发提交尝试事件
        this.triggerEvent(form, 'candy-form-submit-attempt', { form, data });

        const isValid = this.validateForm(form);

        this.triggerEvent(form, 'candy-form-submit', { data, isValid, form });

        if (isValid) {
            this.triggerEvent(form, 'candy-form-success', { data, form });
        } else {
            this.triggerEvent(form, 'candy-form-invalid', { data, form });
            // 显示验证摘要
            this.showValidationSummary(form);
        }
    },

    /**
     * 获取表单数据对象
     */
    getFormData(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return {};

        const data = {};
        const formData = new FormData(formElement);

        formData.forEach((value, key) => {
            data[key] = value;
        });

        // 补充处理 checkbox（未勾选不会出现在 FormData 中）
        formElement.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (!cb.checked && cb.name) {
                data[cb.name] = '';
            }
        });

        return data;
    },

    /**
     * 验证整个表单：同步验证所有字段
     */
    validateForm(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return false;

        let isValid = true;
        const fields = formElement.querySelectorAll('input, select, textarea');

        // 触发验证事件
        this.triggerEvent(formElement, 'candy-form-validation-start', { form: formElement });

        fields.forEach(field => {
            // 跳过隐藏字段
            if (field.offsetParent === null && field.type !== 'hidden') return;
            if (field.type === 'file') return; // 文件上传单独处理

            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        this.triggerEvent(formElement, 'candy-form-validation-end', { form: formElement, isValid });

        return isValid;
    },

    /**
     * 验证单个字段：基础规则 + 自定义验证器
     */
    validateField(field) {
        if (!field) return true;

        const value = (field.value || '').trim();
        let isValid = true;
        let errorMessage = '';

        // --- 必填验证 ---
        if (field.hasAttribute('required') && !value && field.type !== 'file') {
            isValid = false;
            errorMessage = field.getAttribute('data-error-required') || '此字段为必填项';
        }

        // --- 邮箱验证 ---
        if (isValid && field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = field.getAttribute('data-error-email') || '请输入有效的邮箱地址';
            }
        }

        // --- 手机号验证 ---
        if (isValid && field.type === 'tel' && value) {
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(value)) {
                isValid = false;
                errorMessage = field.getAttribute('data-error-tel') || '请输入有效的手机号码';
            }
        }

        // --- URL 验证 ---
        if (isValid && field.type === 'url' && value) {
            try {
                new URL(value);
            } catch (e) {
                isValid = false;
                errorMessage = field.getAttribute('data-error-url') || '请输入有效的URL地址';
            }
        }

        // --- 最小长度验证 ---
        if (isValid && field.hasAttribute('minlength')) {
            const minLength = parseInt(field.getAttribute('minlength'));
            if (value.length > 0 && value.length < minLength) {
                isValid = false;
                errorMessage = `至少需要 ${minLength} 个字符`;
            }
        }

        // --- 最大长度验证 ---
        if (isValid && field.hasAttribute('maxlength')) {
            const maxLength = parseInt(field.getAttribute('maxlength'));
            if (value.length > maxLength) {
                isValid = false;
                errorMessage = `最多只能输入 ${maxLength} 个字符`;
            }
        }

        // --- 数值范围验证 (min/max) ---
        if (isValid && field.type === 'number' && value) {
            const num = parseFloat(value);
            if (field.hasAttribute('min') && num < parseFloat(field.getAttribute('min'))) {
                isValid = false;
                errorMessage = `数值不能小于 ${field.getAttribute('min')}`;
            }
            if (isValid && field.hasAttribute('max') && num > parseFloat(field.getAttribute('max'))) {
                isValid = false;
                errorMessage = `数值不能大于 ${field.getAttribute('max')}`;
            }
        }

        // --- data-rule 属性：自定义验证规则（可多个，用空格分隔） ---
        if (isValid && value && field.hasAttribute('data-rule')) {
            const rules = field.getAttribute('data-rule').split(/\s+/);
            for (const rule of rules) {
                const { name, param } = this.parseRule(rule);
                const result = this.runBuiltinRule(name, value, param, field);
                if (!result.valid) {
                    isValid = false;
                    errorMessage = result.message;
                    break;
                }
            }
        }

        // --- 自定义验证器（通过 addCustomValidator 注册） ---
        if (isValid) {
            const key = this.getFieldKey(field);
            const validators = this.customValidators[key] || [];
            const selectorValidators = this.customValidators['#' + field.id] || [];
            const allValidators = [...validators, ...selectorValidators];

            for (const v of allValidators) {
                try {
                    const result = v(value, field);
                    if (result === false) {
                        isValid = false;
                        errorMessage = '字段验证失败';
                        break;
                    }
                    if (typeof result === 'string' && result) {
                        isValid = false;
                        errorMessage = result;
                        break;
                    }
                    if (typeof result === 'object' && result.valid === false) {
                        isValid = false;
                        errorMessage = result.message || '字段验证失败';
                        break;
                    }
                } catch (err) {
                    isValid = false;
                    errorMessage = err.message || '验证异常';
                    break;
                }
            }
        }

        // 显示或清除错误
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }

        // 触发字段验证事件
        this.triggerEvent(field, 'candy-field-validated', { field, value, isValid, message: errorMessage });

        return isValid;
    },

    /**
     * 解析 data-rule 中的规则字符串（如 "equalTo:#password" 或 "minLength:6"）
     */
    parseRule(rule) {
        const idx = rule.indexOf(':');
        if (idx === -1) return { name: rule, param: '' };
        return { name: rule.substring(0, idx), param: rule.substring(idx + 1) };
    },

    /**
     * 显示字段错误提示
     */
    showFieldError(field, message) {
        this.clearFieldError(field);

        const errorEl = document.createElement('div');
        errorEl.className = 'candy-form-error';
        errorEl.setAttribute('data-candy-error', '1');
        errorEl.textContent = message;

        field.parentNode.appendChild(errorEl);
        field.style.borderColor = '#ef4444';
        field.setAttribute('data-candy-valid', 'false');
    },

    /**
     * 清除字段错误提示
     */
    clearFieldError(field) {
        const errorEl = field.parentNode.querySelector('.candy-form-error[data-candy-error]');
        if (errorEl) {
            errorEl.remove();
        }
        field.style.borderColor = '';
        field.removeAttribute('data-candy-valid');
    },

    /**
     * 重置表单：清空数据、清除错误、重置 dirty 状态
     */
    reset(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return;

        formElement.reset();
        formElement.querySelectorAll('.candy-form-error[data-candy-error]').forEach(el => el.remove());
        formElement.querySelectorAll('.candy-form-validation-summary').forEach(el => el.remove());
        formElement.querySelectorAll('input, select, textarea').forEach(field => {
            field.style.borderColor = '';
            field.removeAttribute('data-candy-valid');
            // 重置原始值与 dirty 状态
            const key = this.getFieldKey(field);
            this.originalValues[key] = this.getFieldValue(field);
            this.markClean(field);
        });

        this.triggerEvent(formElement, 'candy-form-reset', { form: formElement });
    },

    /**
     * 禁用表单：所有输入与按钮不可操作
     */
    disable(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return;
        formElement.querySelectorAll('input, select, textarea, button').forEach(el => {
            el.disabled = true;
        });
    },

    /**
     * 启用表单
     */
    enable(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return;
        formElement.querySelectorAll('input, select, textarea, button').forEach(el => {
            el.disabled = false;
        });
    },

    // =========================================================================
    // 二、实时验证增强
    // =========================================================================

    /**
     * 为指定字段添加自定义验证器
     * @param {string} selector - 字段选择器（如 "#field" 或 "[name='email']"）
     * @param {Function} validator - 返回 true/false 或 { valid, message }
     */
    addCustomValidator(selector, validator) {
        if (typeof validator !== 'function') return;
        if (!this.customValidators[selector]) {
            this.customValidators[selector] = [];
        }
        this.customValidators[selector].push(validator);

        // 为匹配的字段绑定实时验证
        document.querySelectorAll(selector).forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => this.validateField(field));
        });
    },

    /**
     * 异步验证字段
     * @param {Element|string} field - 字段元素或选择器
     * @param {Function} callback - 回调函数 callback(isValid, message)
     */
    validateFieldAsync(field, callback) {
        const el = this.resolveElement(field);
        if (!el) {
            callback && callback(true, '');
            return;
        }

        const key = '#' + el.id;
        const asyncFn = this.asyncValidators[key] || this.asyncValidators[el.name];

        // 显示加载状态
        el.setAttribute('data-candy-validating', 'true');
        el.style.borderColor = '#f59e0b';

        const done = (isValid, message) => {
            el.removeAttribute('data-candy-validating');
            if (!isValid) {
                this.showFieldError(el, message || '异步验证失败');
            } else {
                this.clearFieldError(el);
            }
            callback && callback(isValid, message);
        };

        if (asyncFn) {
            try {
                const result = asyncFn(el.value, el);
                if (result && typeof result.then === 'function') {
                    result.then(r => {
                        if (r === true || r.valid === true) done(true);
                        else done(false, typeof r === 'string' ? r : (r.message || '验证失败'));
                    }).catch(err => done(false, err.message || '验证异常'));
                } else if (result === true) {
                    done(true);
                } else {
                    done(false, typeof result === 'string' ? result : (result.message || '验证失败'));
                }
            } catch (err) {
                done(false, err.message || '验证异常');
            }
        } else {
            // 无异步验证器，走同步
            const syncValid = this.validateField(el);
            done(syncValid, '');
        }
    },

    /**
     * 添加异步验证器
     */
    addAsyncValidator(selector, asyncFn) {
        if (typeof asyncFn !== 'function') return;
        this.asyncValidators[selector] = asyncFn;
    },

    /**
     * 显示验证摘要（汇总所有错误字段）
     * @param {Element|string} form - 表单元素或选择器
     * @param {string} summarySelector - 摘要容器选择器（可选）
     */
    showValidationSummary(form, summarySelector) {
        const formElement = this.resolveElement(form);
        if (!formElement) return;

        // 清除旧摘要
        formElement.querySelectorAll('.candy-form-validation-summary').forEach(el => el.remove());

        // 收集错误
        const errors = [];
        formElement.querySelectorAll('input, select, textarea').forEach(field => {
            const errEl = field.parentNode.querySelector('.candy-form-error[data-candy-error]');
            if (errEl) {
                errors.push({
                    field,
                    label: (field.parentNode.querySelector('label')?.textContent || field.name || field.id),
                    message: errEl.textContent
                });
            }
        });

        if (errors.length === 0) return;

        // 创建摘要容器
        const summary = document.createElement('div');
        summary.className = 'candy-form-validation-summary';
        summary.style.cssText = `
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 0.9rem;
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
        title.textContent = `表单包含 ${errors.length} 个错误，请检查：`;
        summary.appendChild(title);

        const ul = document.createElement('ul');
        ul.style.cssText = 'margin: 0; padding-left: 20px;';
        errors.forEach(err => {
            const li = document.createElement('li');
            li.textContent = `${err.label.replace(/\s*\*\s*$/, '')}：${err.message}`;
            li.style.cssText = 'cursor: pointer; text-decoration: underline; margin-bottom: 4px;';
            li.addEventListener('click', () => {
                err.field.focus();
                err.field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            ul.appendChild(li);
        });
        summary.appendChild(ul);

        // 插入到表单开头或指定位置
        if (summarySelector) {
            const target = document.querySelector(summarySelector);
            if (target) {
                target.innerHTML = '';
                target.appendChild(summary);
                return;
            }
        }
        formElement.insertBefore(summary, formElement.firstChild);
    },

    // =========================================================================
    // 三、自定义验证规则（内置）
    // =========================================================================

    /**
     * 运行内置验证规则
     */
    runBuiltinRule(ruleName, value, param, field) {
        const rule = this.builtinRules[ruleName];
        if (!rule) return { valid: true, message: '' };
        try {
            const result = rule.validate(value, param, field);
            return { valid: !!result, message: result ? '' : rule.message(param, value, field) };
        } catch (e) {
            return { valid: false, message: rule.message(param, value, field) };
        }
    },

    /** 内置规则集合 */
    builtinRules: {
        /** 等于另一个字段的值（常用于密码确认） */
        equalTo: {
            validate: (value, param, field) => {
                const other = document.querySelector(param);
                return !other || value === other.value;
            },
            message: (param) => `该值必须与 ${param} 字段相同`
        },

        /** 不等于另一个字段的值 */
        notEqualTo: {
            validate: (value, param, field) => {
                const other = document.querySelector(param);
                return !other || value !== other.value;
            },
            message: (param) => `该值不能与 ${param} 字段相同`
        },

        /** 包含指定字符串 */
        contains: {
            validate: (value, param) => value.indexOf(param) !== -1,
            message: (param) => `必须包含 "${param}"`
        },

        /** 以指定字符串开头 */
        startsWith: {
            validate: (value, param) => value.startsWith(param),
            message: (param) => `必须以 "${param}" 开头`
        },

        /** 以指定字符串结尾 */
        endsWith: {
            validate: (value, param) => value.endsWith(param),
            message: (param) => `必须以 "${param}" 结尾`
        },

        /** 数字（整数或小数） */
        isNumeric: {
            validate: (value) => /^-?\d+(\.\d+)?$/.test(value),
            message: () => '必须是有效的数字'
        },

        /** 整数 */
        isInteger: {
            validate: (value) => /^-?\d+$/.test(value),
            message: () => '必须是整数'
        },

        /** 日期格式（YYYY-MM-DD 或 YYYY/MM/DD） */
        isDate: {
            validate: (value) => {
                if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value)) return false;
                const d = new Date(value.replace(/\//g, '-'));
                return !isNaN(d.getTime());
            },
            message: () => '必须是有效的日期格式 (YYYY-MM-DD)'
        },

        /** 时间格式（HH:mm 或 HH:mm:ss） */
        isTime: {
            validate: (value) => /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(value),
            message: () => '必须是有效的时间格式 (HH:mm 或 HH:mm:ss)'
        },

        /** 强密码：8+字符、大小写字母、数字、特殊字符 */
        isStrongPassword: {
            validate: (value) => {
                if (value.length < 8) return false;
                if (!/[a-z]/.test(value)) return false;
                if (!/[A-Z]/.test(value)) return false;
                if (!/\d/.test(value)) return false;
                if (!/[^a-zA-Z0-9]/.test(value)) return false;
                return true;
            },
            message: () => '密码至少8位，须包含大小写字母、数字及特殊字符'
        },

        /** 匹配自定义正则表达式（通过 data-rule-pattern 传入） */
        matchPattern: {
            validate: (value, param, field) => {
                let pattern = param;
                if (!pattern && field.hasAttribute('data-rule-pattern')) {
                    pattern = field.getAttribute('data-rule-pattern');
                }
                if (!pattern) return true;
                const regex = new RegExp(pattern);
                return regex.test(value);
            },
            message: () => '格式不符合要求'
        },

        /** 最小长度（param 为数字字符串） */
        minLength: {
            validate: (value, param) => value.length >= parseInt(param || '0'),
            message: (param) => `最少需要 ${param} 个字符`
        },

        /** 最大长度 */
        maxLength: {
            validate: (value, param) => value.length <= parseInt(param || '99999'),
            message: (param) => `最多 ${param} 个字符`
        },

        /** 中文 */
        isChinese: {
            validate: (value) => /^[\u4e00-\u9fa5]+$/.test(value),
            message: () => '只能输入中文字符'
        }
    },

    // =========================================================================
    // 四、文件上传支持
    // =========================================================================

    /**
     * 启用文件上传功能
     * @param {string} selector - 文件 input 选择器
     * @param {Object} options - { accept, maxSize, maxFiles, multiple, progressTarget, url }
     */
    enableFileUpload(selector, options = {}) {
        const input = document.querySelector(selector);
        if (!input || input.type !== 'file') return;

        const config = {
            accept: options.accept || null,           // 'image/*' 或 '.jpg,.png'
            maxSize: options.maxSize || 10 * 1024 * 1024, // 默认 10MB
            maxFiles: options.maxFiles || 10,
            multiple: options.multiple === true,
            progressTarget: options.progressTarget || null,
            url: options.url || null,
            onSelect: options.onSelect || null,
            onProgress: options.onProgress || null,
            onSuccess: options.onSuccess || null,
            onError: options.onError || null
        };

        if (config.multiple) input.setAttribute('multiple', 'multiple');
        if (config.accept) input.setAttribute('accept', config.accept);

        this.fileUploadConfigs[selector] = config;

        // 绑定 change 事件
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;

            // 检查文件数量
            if (files.length > config.maxFiles) {
                this.showFileError(input, `最多只能上传 ${config.maxFiles} 个文件`);
                e.target.value = '';
                return;
            }

            // 检查每个文件的类型和大小
            for (const file of files) {
                // 类型检查
                if (config.accept) {
                    const acceptList = config.accept.split(',').map(s => s.trim());
                    let typeOk = false;
                    for (const acc of acceptList) {
                        if (acc.startsWith('.')) {
                            if (file.name.toLowerCase().endsWith(acc.toLowerCase())) {
                                typeOk = true;
                                break;
                            }
                        } else if (acc.endsWith('/*')) {
                            const prefix = acc.slice(0, -1);
                            if (file.type.startsWith(prefix)) {
                                typeOk = true;
                                break;
                            }
                        } else if (acc === file.type) {
                            typeOk = true;
                            break;
                        }
                    }
                    if (!typeOk) {
                        this.showFileError(input, `文件 "${file.name}" 类型不允许`);
                        e.target.value = '';
                        return;
                    }
                }

                // 大小检查
                if (file.size > config.maxSize) {
                    const sizeMB = (config.maxSize / 1024 / 1024).toFixed(2);
                    this.showFileError(input, `文件 "${file.name}" 超过最大允许大小 ${sizeMB}MB`);
                    e.target.value = '';
                    return;
                }
            }

            // 文件检查通过
            this.clearFileError(input);

            if (config.onSelect) config.onSelect(files, input);

            // 若提供 URL，则模拟上传进度
            if (config.url) {
                this.uploadFiles(files, config, input);
            } else {
                // 仅显示本地文件信息
                this.updateFileInfo(selector, files, config);
            }
        });
    },

    /** 显示文件错误 */
    showFileError(input, message) {
        this.clearFileError(input);
        const errorEl = document.createElement('div');
        errorEl.className = 'candy-form-error candy-form-file-error';
        errorEl.textContent = message;
        input.parentNode.appendChild(errorEl);
        input.style.borderColor = '#ef4444';
    },

    /** 清除文件错误 */
    clearFileError(input) {
        input.parentNode.querySelectorAll('.candy-form-file-error').forEach(el => el.remove());
        input.parentNode.querySelectorAll('.candy-form-file-info').forEach(el => el.remove());
        input.style.borderColor = '';
    },

    /** 更新文件信息显示 */
    updateFileInfo(selector, files, config) {
        const input = document.querySelector(selector);
        if (!input) return;

        let infoEl = input.parentNode.querySelector('.candy-form-file-info');
        if (!infoEl) {
            infoEl = document.createElement('div');
            infoEl.className = 'candy-form-file-info';
            infoEl.style.cssText = 'margin-top: 8px; font-size: 0.85rem; color: #64748b;';
            input.parentNode.appendChild(infoEl);
        }

        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        infoEl.innerHTML = `
            已选择 <strong>${files.length}</strong> 个文件，
            总大小 <strong>${this.formatFileSize(totalSize)}</strong>
            <div style="margin-top: 4px;">
                ${files.map(f => `<div>📄 ${f.name} (${this.formatFileSize(f.size)})</div>`).join('')}
            </div>
        `;
    },

    /** 格式化文件大小 */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
    },

    /** 模拟上传（使用 setTimeout 递增进度） */
    uploadFiles(files, config, input) {
        // 创建或获取进度条容器
        let progressEl = config.progressTarget ? document.querySelector(config.progressTarget) : null;
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.className = 'candy-form-file-progress';
            progressEl.style.cssText = 'margin-top: 8px;';
            input.parentNode.appendChild(progressEl);
        }

        // 为每个文件创建进度条
        progressEl.innerHTML = '';
        files.forEach((file, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom: 8px;';

            const label = document.createElement('div');
            label.style.cssText = 'font-size: 0.85rem; color: #334155; margin-bottom: 4px;';
            label.textContent = `${file.name} - 准备中...`;
            row.appendChild(label);

            const bar = document.createElement('div');
            bar.style.cssText = 'background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden;';

            const fill = document.createElement('div');
            fill.style.cssText = 'background: linear-gradient(90deg, #3b82f6, #10b981); height: 100%; width: 0%; transition: width 0.2s;';
            bar.appendChild(fill);
            row.appendChild(bar);

            progressEl.appendChild(row);

            // 模拟进度
            let progress = 0;
            const timer = setInterval(() => {
                progress += Math.random() * 15 + 5;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(timer);
                    label.textContent = `${file.name} - ✅ 上传完成 (${this.formatFileSize(file.size)})`;
                    if (idx === files.length - 1 && config.onSuccess) {
                        config.onSuccess(files);
                    }
                } else {
                    label.textContent = `${file.name} - 上传中 ${progress.toFixed(0)}%`;
                }
                fill.style.width = progress + '%';
                if (config.onProgress) config.onProgress(file, progress, files.length);
            }, 300);
        });
    },

    // =========================================================================
    // 五、自动保存草稿
    // =========================================================================

    /**
     * 启用表单自动保存草稿到 localStorage
     * @param {string} selector - 表单选择器
     * @param {Object} options - { key, interval(ms), onSave, onLoad }
     */
    enableAutoSave(selector, options = {}) {
        const form = document.querySelector(selector);
        if (!form) return;

        const config = {
            key: options.key || `candy-form-draft:${selector}`,
            interval: options.interval || 30000, // 默认 30 秒
            onSave: options.onSave || null,
            onLoad: options.onLoad || null,
            autoSave: options.autoSave !== false
        };

        this.draftConfigs[selector] = config;

        // 页面加载时尝试恢复草稿
        setTimeout(() => {
            if (config.autoSave) {
                const loaded = this.loadDraft(selector);
                if (loaded && config.onLoad) config.onLoad(loaded);
            }
        }, 100);

        // 字段变化时保存
        form.addEventListener('input', () => {
            this.saveDraft(selector);
        });

        // 页面关闭前保存
        window.addEventListener('beforeunload', () => {
            this.saveDraft(selector);
        });

        // 定时保存
        if (config.interval > 0) {
            config.timer = setInterval(() => {
                this.saveDraft(selector);
            }, config.interval);
        }
    },

    /** 手动保存草稿 */
    saveDraft(selector) {
        const form = document.querySelector(selector);
        if (!form) return false;

        const config = this.draftConfigs[selector] || { key: `candy-form-draft:${selector}` };
        try {
            const data = this.getFormData(form);
            const payload = {
                data,
                savedAt: new Date().toISOString(),
                version: 1
            };
            localStorage.setItem(config.key, JSON.stringify(payload));
            if (config.onSave) config.onSave(payload);
            return true;
        } catch (err) {
            console.warn('[CandyForm] 草稿保存失败:', err);
            return false;
        }
    },

    /** 加载并恢复草稿 */
    loadDraft(selector) {
        const form = document.querySelector(selector);
        if (!form) return null;

        const config = this.draftConfigs[selector] || { key: `candy-form-draft:${selector}` };
        try {
            const raw = localStorage.getItem(config.key);
            if (!raw) return null;

            const payload = JSON.parse(raw);
            if (!payload || !payload.data) return null;

            // 恢复表单字段值
            Object.keys(payload.data).forEach(name => {
                const field = form.querySelector(`[name="${name}"]`);
                if (!field) return;
                const value = payload.data[name];
                if (field.type === 'checkbox') {
                    field.checked = !!value;
                } else if (field.type === 'radio') {
                    const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                } else {
                    field.value = value;
                }
            });

            return payload;
        } catch (err) {
            console.warn('[CandyForm] 草稿加载失败:', err);
            return null;
        }
    },

    /** 清除草稿 */
    clearDraft(selector) {
        const config = this.draftConfigs[selector] || { key: `candy-form-draft:${selector}` };
        try {
            localStorage.removeItem(config.key);
            return true;
        } catch (err) {
            return false;
        }
    },

    // =========================================================================
    // 六、多步骤表单
    // =========================================================================

    /**
     * 创建多步骤表单
     * @param {string} selector - 表单选择器
     * @param {Object} options - { steps: [{title, selector}], showIndicator }
     */
    createStepForm(selector, options = {}) {
        const form = document.querySelector(selector);
        if (!form) return;

        const steps = options.steps || [];
        if (steps.length === 0) return;

        // 查找所有 .candy-form-step 元素作为步骤
        const stepElements = form.querySelectorAll('.candy-form-step');
        const actualSteps = stepElements.length > 0 ? Array.from(stepElements).map((el, i) => ({
            title: el.getAttribute('data-step-title') || `步骤 ${i + 1}`,
            element: el
        })) : steps.map(s => {
            const el = document.querySelector(s.selector);
            return { title: s.title, element: el };
        }).filter(s => s.element);

        const config = {
            steps: actualSteps,
            currentStep: 0,
            showIndicator: options.showIndicator !== false,
            onStepChange: options.onStepChange || null
        };

        this.stepForms[selector] = config;

        // 构建步骤指示器
        if (config.showIndicator) {
            this.buildStepIndicator(form, config);
        }

        // 隐藏所有步骤，仅显示第一步
        actualSteps.forEach((step, i) => {
            step.element.style.display = i === 0 ? '' : 'none';
            step.element.setAttribute('data-step-index', i);
        });

        // 更新指示器
        this.updateStepIndicator(selector);

        // 查找并绑定上一步/下一步按钮
        form.querySelectorAll('[data-step-prev]').forEach(btn => {
            btn.addEventListener('click', () => this.prevStep(selector));
        });
        form.querySelectorAll('[data-step-next]').forEach(btn => {
            btn.addEventListener('click', () => this.nextStep(selector));
        });
    },

    /** 构建步骤指示器（顶部进度条） */
    buildStepIndicator(form, config) {
        const indicator = document.createElement('div');
        indicator.className = 'candy-form-step-indicator';
        indicator.style.cssText = `
            display: flex;
            justify-content: space-between;
            padding: 20px 24px;
            background: rgba(59, 130, 246, 0.05);
            border-bottom: 1px solid var(--candy-form-border, #cbd5e1);
            position: relative;
        `;

        config.steps.forEach((step, i) => {
            const item = document.createElement('div');
            item.className = 'candy-form-step-item';
            item.style.cssText = 'display: flex; align-items: center; flex: 1; position: relative;';
            item.setAttribute('data-step', i);

            const circle = document.createElement('div');
            circle.className = 'candy-form-step-circle';
            circle.style.cssText = `
                width: 32px; height: 32px; border-radius: 50%;
                background: #e2e8f0; color: #64748b;
                display: flex; align-items: center; justify-content: center;
                font-weight: 600; font-size: 0.9rem;
                transition: all 0.3s;
                flex-shrink: 0;
            `;
            circle.textContent = (i + 1);

            const label = document.createElement('div');
            label.className = 'candy-form-step-label';
            label.style.cssText = 'margin-left: 8px; font-size: 0.9rem; color: #64748b; white-space: nowrap;';
            label.textContent = step.title;

            item.appendChild(circle);
            item.appendChild(label);

            // 步骤之间的连接线
            if (i < config.steps.length - 1) {
                const line = document.createElement('div');
                line.className = 'candy-form-step-line';
                line.style.cssText = `
                    position: absolute;
                    top: 16px;
                    left: 40px;
                    right: -8px;
                    height: 2px;
                    background: #e2e8f0;
                    z-index: 0;
                `;
                item.appendChild(line);
            }

            indicator.appendChild(item);
        });

        form.insertBefore(indicator, form.firstChild);
    },

    /** 更新步骤指示器状态 */
    updateStepIndicator(selector) {
        const config = this.stepForms[selector];
        if (!config) return;

        const form = document.querySelector(selector);
        if (!form) return;

        const items = form.querySelectorAll('.candy-form-step-item');
        items.forEach((item, i) => {
            const circle = item.querySelector('.candy-form-step-circle');
            const label = item.querySelector('.candy-form-step-label');
            const line = item.querySelector('.candy-form-step-line');

            if (i < config.currentStep) {
                // 已完成
                circle.style.background = '#10b981';
                circle.style.color = '#ffffff';
                circle.innerHTML = '✓';
                if (label) label.style.color = '#10b981';
                if (line) line.style.background = '#10b981';
            } else if (i === config.currentStep) {
                // 当前
                circle.style.background = '#3b82f6';
                circle.style.color = '#ffffff';
                circle.textContent = (i + 1);
                if (label) label.style.color = '#3b82f6';
                if (label) label.style.fontWeight = '600';
            } else {
                // 未完成
                circle.style.background = '#e2e8f0';
                circle.style.color = '#64748b';
                circle.textContent = (i + 1);
                if (label) {
                    label.style.color = '#64748b';
                    label.style.fontWeight = '400';
                }
                if (line) line.style.background = '#e2e8f0';
            }
        });
    },

    /** 跳转到指定步骤 */
    goToStep(selector, stepIndex) {
        const config = this.stepForms[selector];
        if (!config) return false;

        if (stepIndex < 0 || stepIndex >= config.steps.length) return false;

        // 验证当前步骤
        const currentEl = config.steps[config.currentStep].element;
        const fields = currentEl.querySelectorAll('input, select, textarea');
        let valid = true;
        if (stepIndex > config.currentStep) {
            fields.forEach(f => {
                if (!this.validateField(f)) valid = false;
            });
            if (!valid) {
                this.showValidationSummary(currentEl);
                return false;
            }
        }

        // 切换显示
        config.steps.forEach((s, i) => {
            s.element.style.display = i === stepIndex ? '' : 'none';
        });

        config.currentStep = stepIndex;
        this.updateStepIndicator(selector);

        if (config.onStepChange) config.onStepChange(stepIndex, config.steps.length);

        const form = document.querySelector(selector);
        this.triggerEvent(form, 'candy-form-step-change', { selector, stepIndex, total: config.steps.length });

        // 滚动到表单顶部
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });

        return true;
    },

    /** 下一步 */
    nextStep(selector) {
        const config = this.stepForms[selector];
        if (!config) return false;
        return this.goToStep(selector, config.currentStep + 1);
    },

    /** 上一步 */
    prevStep(selector) {
        const config = this.stepForms[selector];
        if (!config) return false;
        return this.goToStep(selector, config.currentStep - 1);
    },

    /** 获取当前步骤索引 */
    getCurrentStep(selector) {
        const config = this.stepForms[selector];
        return config ? config.currentStep : -1;
    },

    // =========================================================================
    // 七、字段依赖
    // =========================================================================

    /**
     * 添加字段依赖：当 dependsOn 字段满足 condition 时显示 field，否则隐藏
     * @param {Object} config - { field, dependsOn, condition: { equals|notEquals|contains|greaterThan|lessThan|checked|unchecked } }
     */
    addDependency(config) {
        if (!config || !config.field || !config.dependsOn || !config.condition) return;

        const dep = {
            fieldSelector: config.field,
            dependsOnSelector: config.dependsOn,
            condition: config.condition
        };

        this.dependencies.push(dep);

        // 绑定监听
        const trigger = document.querySelector(dep.dependsOnSelector);
        if (trigger) {
            const handler = () => this.checkDependencies(trigger);
            trigger.addEventListener('change', handler);
            trigger.addEventListener('input', handler);
            handler(); // 初始化状态
        }
    },

    /** 检查所有依赖关系并更新字段显示状态 */
    checkDependencies(triggerField) {
        this.dependencies.forEach(dep => {
            const field = document.querySelector(dep.fieldSelector);
            const trigger = document.querySelector(dep.dependsOnSelector);
            if (!field || !trigger) return;

            // 如果指定了 triggerField 并且不是当前依赖的触发字段，则跳过
            if (triggerField && triggerField !== trigger) return;

            const condition = dep.condition;
            const triggerValue = this.getFieldValue(trigger);
            let show = true;

            if ('equals' in condition) {
                show = show && (triggerValue === condition.equals);
            }
            if ('notEquals' in condition) {
                show = show && (triggerValue !== condition.notEquals);
            }
            if ('contains' in condition) {
                const tv = triggerValue || '';
                show = show && (String(tv).indexOf(condition.contains) !== -1);
            }
            if ('greaterThan' in condition) {
                show = show && (parseFloat(triggerValue) > parseFloat(condition.greaterThan));
            }
            if ('lessThan' in condition) {
                show = show && (parseFloat(triggerValue) < parseFloat(condition.lessThan));
            }
            if ('checked' in condition) {
                show = show && (trigger.checked === condition.checked);
            }
            if ('unchecked' in condition) {
                show = show && (trigger.checked !== condition.unchecked);
            }
            if ('filled' in condition) {
                show = show && (!!triggerValue === condition.filled);
            }

            // 查找 field 对应的组（含 label 的整个 group）
            const group = field.closest('.candy-form-group') || field;

            if (show) {
                group.style.display = '';
                field.disabled = false;
            } else {
                group.style.display = 'none';
                field.disabled = true;
                this.clearFieldError(field);
            }
        });
    },

    // =========================================================================
    // 八、密码强度检测
    // =========================================================================

    /**
     * 启用密码强度检测
     * @param {string} selector - 指示容器选择器
     * @param {string} passwordSelector - 密码字段选择器
     * @param {Object} options - { showLabel: true, showText: true }
     */
    enablePasswordStrength(selector, passwordSelector, options = {}) {
        const container = document.querySelector(selector);
        const passwordField = document.querySelector(passwordSelector);
        if (!container || !passwordField) return;

        const config = {
            showLabel: options.showLabel !== false,
            showText: options.showText !== false,
            onChange: options.onChange || null
        };

        this.passwordStrengthConfigs[selector] = { container, passwordField, config };

        // 构建指示器
        if (config.showLabel) {
            const label = document.createElement('div');
            label.className = 'candy-form-password-label';
            label.style.cssText = 'display: flex; justify-content: space-between; font-size: 0.85rem; color: #64748b; margin-bottom: 6px;';
            label.innerHTML = '<span>密码强度</span><span class="candy-form-password-text">-</span>';
            container.appendChild(label);
        }

        const barWrapper = document.createElement('div');
        barWrapper.className = 'candy-form-password-bar';
        barWrapper.style.cssText = 'display: flex; gap: 4px; height: 6px;';

        for (let i = 0; i < 4; i++) {
            const segment = document.createElement('div');
            segment.className = 'candy-form-password-segment';
            segment.style.cssText = 'flex: 1; background: #e2e8f0; border-radius: 3px; transition: background 0.2s;';
            barWrapper.appendChild(segment);
        }
        container.appendChild(barWrapper);

        const tipText = document.createElement('div');
        tipText.className = 'candy-form-password-tip';
        tipText.style.cssText = 'font-size: 0.8rem; color: #64748b; margin-top: 6px;';
        tipText.textContent = '建议包含：大小写字母、数字、特殊字符';
        container.appendChild(tipText);

        // 绑定输入事件
        passwordField.addEventListener('input', () => {
            this.updatePasswordStrength(selector);
        });
    },

    /** 更新密码强度指示器 */
    updatePasswordStrength(selector) {
        const cfg = this.passwordStrengthConfigs[selector];
        if (!cfg) return;

        const { container, passwordField, config } = cfg;
        const password = passwordField.value;
        const segments = container.querySelectorAll('.candy-form-password-segment');
        const textEl = container.querySelector('.candy-form-password-text');

        // 计算强度分数
        let score = 0;
        if (password.length >= 8) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        if (password.length >= 12) score = Math.min(4, score + 0); // 额外加分条件

        // 如果密码为空，分数为 0
        if (!password) score = 0;

        // 等级描述
        const levels = [
            { text: '无', color: '#94a3b8' },
            { text: '弱', color: '#ef4444' },
            { text: '一般', color: '#f59e0b' },
            { text: '强', color: '#3b82f6' },
            { text: '很强', color: '#10b981' }
        ];
        const level = levels[score];

        // 更新条形颜色
        segments.forEach((seg, i) => {
            if (i < score) {
                seg.style.background = level.color;
            } else {
                seg.style.background = '#e2e8f0';
            }
        });

        // 更新文本
        if (textEl) {
            textEl.textContent = password ? level.text : '-';
            textEl.style.color = level.color;
            textEl.style.fontWeight = '600';
        }

        if (config.onChange) config.onChange(score, level.text, password);
    },

    // =========================================================================
    // 九、数据序列化与导入导出
    // =========================================================================

    /**
     * 将表单数据序列化为 JSON 字符串
     */
    toJSON(selector) {
        const data = this.getFormData(selector);
        return JSON.stringify(data, null, 2);
    },

    /**
     * 从 JSON 对象或 JSON 字符串填充表单
     */
    fromJSON(selector, data) {
        const form = document.querySelector(selector);
        if (!form) return false;

        const obj = typeof data === 'string' ? JSON.parse(data) : data;
        if (!obj || typeof obj !== 'object') return false;

        Object.keys(obj).forEach(name => {
            const value = obj[name];
            const field = form.querySelector(`[name="${name}"]`);
            if (!field) return;

            if (field.type === 'checkbox') {
                if (field.name && field.name.endsWith('[]')) {
                    // 多选 checkbox
                    field.checked = Array.isArray(value) && value.indexOf(field.value) !== -1;
                } else {
                    field.checked = !!value && value !== 'false' && value !== '0';
                }
            } else if (field.type === 'radio') {
                const radios = form.querySelectorAll(`input[name="${name}"]`);
                radios.forEach(r => { r.checked = (r.value === String(value)); });
            } else if (field.tagName === 'SELECT' && field.multiple) {
                Array.from(field.options).forEach(opt => {
                    opt.selected = Array.isArray(value) && value.indexOf(opt.value) !== -1;
                });
            } else {
                field.value = value;
            }

            this.originalValues[this.getFieldKey(field)] = this.getFieldValue(field);
            this.markClean(field);
        });

        return true;
    },

    /**
     * 导出表单数据（触发下载）
     */
    exportData(selector) {
        const form = document.querySelector(selector);
        if (!form) return null;

        const data = this.getFormData(form);
        const payload = {
            exportedAt: new Date().toISOString(),
            form: selector,
            data
        };
        const json = JSON.stringify(payload, null, 2);

        // 触发浏览器下载
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return payload;
    },

    /**
     * 导入数据填充表单（接受 JSON 字符串或对象）
     */
    importData(selector, data) {
        let obj = data;
        if (typeof data === 'string') {
            try {
                obj = JSON.parse(data);
            } catch (e) {
                return { success: false, error: 'JSON 解析失败' };
            }
        }
        // 兼容 exportData 导出的包装格式
        const actual = obj && obj.data ? obj.data : obj;
        const ok = this.fromJSON(selector, actual);
        return ok ? { success: true, data: actual } : { success: false, error: '填充失败' };
    },

    // =========================================================================
    // 十、字段状态管理（dirty / clean）
    // =========================================================================

    /** 将字段标记为已修改 */
    markDirty(field) {
        const key = this.getFieldKey(field);
        if (!key) return;
        this.dirtyFields[key] = true;
        field.setAttribute('data-candy-dirty', 'true');
    },

    /** 将字段标记为未修改 */
    markClean(field) {
        const key = this.getFieldKey(field);
        if (!key) return;
        this.dirtyFields[key] = false;
        field.removeAttribute('data-candy-dirty');
    },

    /** 检查表单是否有任何字段被修改 */
    isDirty(selector) {
        const form = this.resolveElement(selector);
        if (!form) return false;

        const fields = form.querySelectorAll('input, select, textarea');
        for (const f of fields) {
            const key = this.getFieldKey(f);
            if (this.dirtyFields[key]) return true;
        }
        return false;
    },

    /** 获取所有被修改的字段名/值 */
    getDirtyFields(selector) {
        const form = this.resolveElement(selector);
        if (!form) return [];

        const result = [];
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(f => {
            const key = this.getFieldKey(f);
            if (this.dirtyFields[key]) {
                result.push({
                    name: f.name || f.id,
                    field: f,
                    value: this.getFieldValue(f),
                    original: this.originalValues[key]
                });
            }
        });
        return result;
    },

    // =========================================================================
    // 十一、事件系统
    // =========================================================================

    /**
     * 绑定字段变化事件
     */
    onFieldChange(selector, callback) {
        if (typeof callback !== 'function') return;
        const el = document.querySelector(selector);
        if (!el) return;
        this.bindEvent(el, 'candy-field-change', callback);
    },

    /**
     * 绑定验证事件
     */
    onValidation(selector, callback) {
        if (typeof callback !== 'function') return;
        const el = this.resolveElement(selector);
        if (!el) return;
        this.bindEvent(el, 'candy-form-validation-start', callback);
    },

    /**
     * 绑定表单就绪事件
     */
    onFormReady(selector, callback) {
        if (typeof callback !== 'function') return;
        const el = this.resolveElement(selector);
        if (!el) return;
        this.bindEvent(el, 'candy-form-ready', callback);
    },

    /**
     * 绑定提交尝试事件
     */
    onSubmitAttempt(selector, callback) {
        if (typeof callback !== 'function') return;
        const el = this.resolveElement(selector);
        if (!el) return;
        this.bindEvent(el, 'candy-form-submit-attempt', callback);
    },

    /** 内部：绑定自定义事件 */
    bindEvent(element, eventName, callback) {
        element.addEventListener(eventName, (e) => {
            callback(e.detail || {}, e);
        });
    },

    /** 内部：触发自定义事件 */
    triggerEvent(element, eventName, detail) {
        try {
            const event = new CustomEvent(eventName, { detail, bubbles: true, cancelable: true });
            if (element && element.dispatchEvent) {
                element.dispatchEvent(event);
            }
        } catch (e) {
            // 忽略事件触发异常
        }
    },

    // =========================================================================
    // 十二、动态创建表单与字段
    // =========================================================================

    /**
     * 创建一个新的 CandyForm
     */
    create(options = {}) {
        const form = document.createElement('form');
        form.className = 'candy-form';

        if (options.header) {
            const header = document.createElement('div');
            header.className = 'candy-form-header';
            header.innerHTML = `
                <h1><i class="${options.header.icon || 'fas fa-forms'}"></i> ${options.header.title || ''}</h1>
                ${options.header.description ? `<p>${options.header.description}</p>` : ''}
            `;
            form.appendChild(header);
        }

        const body = document.createElement('div');
        body.className = 'candy-form-body';

        if (options.sections && Array.isArray(options.sections)) {
            options.sections.forEach(section => {
                const sectionEl = document.createElement('div');
                sectionEl.className = 'candy-form-section';

                if (section.title) {
                    const title = document.createElement('div');
                    title.className = 'candy-form-section-title';
                    title.innerHTML = `<i class="${section.icon || 'fas fa-info-circle'}"></i> ${section.title}`;
                    sectionEl.appendChild(title);
                }

                if (section.fields && Array.isArray(section.fields)) {
                    section.fields.forEach(field => {
                        const fieldEl = this.createField(field);
                        sectionEl.appendChild(fieldEl);
                    });
                }

                body.appendChild(sectionEl);
            });
        }

        form.appendChild(body);

        if (options.buttons) {
            const footer = document.createElement('div');
            footer.className = 'candy-form-footer';

            options.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.type = btn.type || 'button';
                button.className = `candy-form-btn candy-form-btn-${btn.variant || 'primary'}`;
                button.textContent = btn.text || '按钮';

                if (btn.onClick) {
                    button.addEventListener('click', btn.onClick);
                }

                footer.appendChild(button);
            });

            form.appendChild(footer);
        }

        if (options.onSubmit) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                options.onSubmit(this.getFormData(form), form);
            });
        }

        if (options.parent) {
            document.querySelector(options.parent).appendChild(form);
        }

        // 为新创建的表单绑定事件
        this.bindDynamicFormEvents(form);

        return form;
    },

    /** 为动态创建的表单绑定事件 */
    bindDynamicFormEvents(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(form);
        });

        form.querySelectorAll('input, select, textarea').forEach(field => {
            const key = this.getFieldKey(field);
            this.originalValues[key] = this.getFieldValue(field);

            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => {
                this.clearFieldError(field);
                this.handleFieldChange(field);
            });
            field.addEventListener('change', () => this.handleFieldChange(field));
        });

        setTimeout(() => {
            this.triggerEvent(form, 'candy-form-ready', { form });
        }, 0);
    },

    /**
     * 创建单个字段组件
     */
    createField(options = {}) {
        const group = document.createElement('div');
        group.className = 'candy-form-group';

        if (options.label) {
            const label = document.createElement('label');
            label.textContent = options.label;
            if (options.required) label.textContent += ' *';
            if (options.id) label.setAttribute('for', options.id);
            group.appendChild(label);
        }

        let field;

        switch (options.type) {
            case 'textarea':
                field = document.createElement('textarea');
                field.className = 'candy-form-textarea';
                if (options.placeholder) field.placeholder = options.placeholder;
                if (options.rows) field.rows = options.rows;
                if (options.value) field.value = options.value;
                break;

            case 'select':
                field = document.createElement('select');
                field.className = 'candy-form-select';
                if (options.options) {
                    options.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value !== undefined ? opt.value : opt;
                        option.textContent = opt.label || opt;
                        if (opt.selected) option.selected = true;
                        field.appendChild(option);
                    });
                }
                break;

            case 'checkbox':
            case 'radio':
                field = document.createElement('input');
                field.className = 'candy-form-input';
                field.type = options.type;
                if (options.value) field.value = options.value;
                if (options.checked) field.checked = true;
                break;

            default:
                field = document.createElement('input');
                field.className = 'candy-form-input';
                field.type = options.type || 'text';
                if (options.placeholder) field.placeholder = options.placeholder;
                if (options.value) field.value = options.value;
                if (options.pattern) field.pattern = options.pattern;
        }

        if (options.name) field.name = options.name;
        if (options.id) field.id = options.id;
        if (options.required) field.required = true;
        if (options.disabled) field.disabled = true;
        if (options.readonly) field.readOnly = true;
        if (options.minLength) field.setAttribute('minlength', options.minLength);
        if (options.maxLength) field.setAttribute('maxlength', options.maxLength);
        if (options.min !== undefined) field.setAttribute('min', options.min);
        if (options.max !== undefined) field.setAttribute('max', options.max);
        if (options.rule) field.setAttribute('data-rule', options.rule);
        if (options.patternAttr) field.setAttribute('data-rule-pattern', options.patternAttr);

        group.appendChild(field);

        if (options.hint) {
            const hint = document.createElement('div');
            hint.className = 'candy-form-hint';
            hint.textContent = options.hint;
            group.appendChild(hint);
        }

        return group;
    },

    // =========================================================================
    // 十三、工具方法
    // =========================================================================

    /** 聚焦到第一个有错误的字段 */
    focusFirstError(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return;
        const errField = formElement.querySelector('[data-candy-valid="false"]');
        if (errField) errField.focus();
    },

    /** 清除所有验证错误 */
    clearAllErrors(form) {
        const formElement = this.resolveElement(form);
        if (!formElement) return;
        formElement.querySelectorAll('input, select, textarea').forEach(f => {
            this.clearFieldError(f);
        });
        formElement.querySelectorAll('.candy-form-validation-summary').forEach(el => el.remove());
    },

    /** 滚动到表单 */
    scrollTo(selector) {
        const el = this.resolveElement(selector);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyForm.init();
});

// 兼容 AMD/CommonJS（若在浏览器中使用，暴露到全局）
if (typeof window !== 'undefined') {
    window.CandyForm = CandyForm;
}
