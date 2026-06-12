/**
 * CandyProgress - CandyUI 进度条组件（增强版）
 * 支持：基础进度条、堆叠进度条、环形进度条、不确定状态、步进、事件回调、自动变色、动画控制、数据绑定
 */
const CandyProgress = {

    // ============================================================
    // 一、初始化与核心工具方法
    // ============================================================

    /** 组件初始化 */
    init() {
        this.bindEvents();
        this.initializeProgressBars();
    },

    /** 解析 HTML 中已存在的进度条（读取 data-progress、data-step 等） */
    initializeProgressBars() {
        const progressBars = document.querySelectorAll('.candy-progress');
        progressBars.forEach(progress => {
            const bar = progress.querySelector('.candy-progress-bar');
            const dataProgress = progress.getAttribute('data-progress');
            const dataStep = progress.getAttribute('data-step');
            const dataDecimal = progress.getAttribute('data-decimal');

            if (dataProgress !== null) {
                bar.style.width = dataProgress + '%';
                this.updateValueDisplay(progress, parseFloat(dataProgress), parseInt(dataDecimal) || 0);
            }

            // 若设置了步进信息，则记录到当前步骤（未启动）
            if (dataStep !== null) {
                progress.dataset.step = dataStep;
                progress.dataset.currentStep = progress.dataset.currentStep || 0;
            }
        });
    },

    /** 绑定全局点击事件（支持点击跳转） */
    bindEvents() {
        document.addEventListener('click', (e) => {
            const progress = e.target.closest('.candy-progress');
            if (progress && !progress.classList.contains('candy-progress-indeterminate')) {
                this.handleProgressClick(progress, e);
            }
        });
    },

    /** 根据点击位置更新进度 */
    handleProgressClick(progress, e) {
        const rect = progress.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.round((x / rect.width) * 100);
        const clampedPercent = Math.max(0, Math.min(100, percent));
        this.setProgress(progress, clampedPercent);
    },

    /** 工具：从 selector 或 Element 解析出 DOM */
    _resolveEl(selector) {
        return typeof selector === 'string' ? document.querySelector(selector) : selector;
    },

    /** 工具：格式化数字（控制小数精度） */
    _formatNumber(value, decimal) {
        const d = decimal || 0;
        return Number(value).toFixed(d);
    },

    // ============================================================
    // 二、基础进度条（保留原有 API）
    // ============================================================

    /** 设置进度值（0-100） */
    setProgress(selector, value) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        const bar = progress.querySelector('.candy-progress-bar');
        const clampedValue = Math.max(0, Math.min(100, value));
        const decimal = parseInt(progress.dataset.decimal) || 0;
        const oldValue = this.getProgress(progress);

        // 首次变化事件（start）
        if (oldValue === 0 && clampedValue > 0) {
            progress.dispatchEvent(new CustomEvent('candy-progress-start', {
                detail: { value: clampedValue },
                bubbles: true
            }));
        }

        bar.style.width = clampedValue + '%';
        this.updateValueDisplay(progress, clampedValue, decimal);

        // 自动颜色切换
        if (progress.dataset.autoColor === 'true') {
            this._applyAutoColor(progress, clampedValue);
        }

        // 变化事件
        progress.dispatchEvent(new CustomEvent('candy-progress-change', {
            detail: { value: clampedValue, previous: oldValue },
            bubbles: true
        }));

        // 完成事件
        if (clampedValue >= 100 && oldValue < 100) {
            progress.dispatchEvent(new CustomEvent('candy-progress-complete', {
                detail: { value: 100 },
                bubbles: true
            }));
        }
    },

    /** 获取当前进度值 */
    getProgress(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return 0;

        const bar = progress.querySelector('.candy-progress-bar');
        const width = bar ? (bar.style.width || '0%') : '0%';
        return parseFloat(width) || 0;
    },

    /** 更新显示文本 */
    updateValueDisplay(progress, value, decimal = 0) {
        const valueEl = progress.querySelector('.candy-progress-value');
        if (valueEl) {
            const format = progress.dataset.valueFormat;
            if (format) {
                valueEl.textContent = format.replace('{value}', this._formatNumber(value, decimal));
            } else {
                valueEl.textContent = this._formatNumber(value, decimal) + '%';
            }
        }
    },

    /** 动画到目标值（支持暂停/恢复/停止） */
    animateTo(selector, targetValue, duration = 500) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        this._cancelExistingAnimation(progress);

        const startValue = this.getProgress(progress);
        const startTime = performance.now();

        // 保存动画状态，支持 pause/resume/stop
        const anim = {
            id: 0,
            paused: false,
            pausedAt: 0,
            pauseTotal: 0,
            target: targetValue,
            startValue: startValue,
            startTime: startTime,
            duration: duration
        };
        progress._animation = anim;

        const animate = (currentTime) => {
            if (!progress._animation) return;
            if (progress._animation.paused) {
                // 即使暂停也请求下一帧，方便 resume 后可以继续
                progress._animation.id = requestAnimationFrame(animate);
                return;
            }

            const effectiveTime = currentTime - progress._animation.pauseTotal;
            const elapsed = effectiveTime - progress._animation.startTime;
            const progressRatio = Math.min(elapsed / progress._animation.duration, 1);
            const easeOut = 1 - Math.pow(1 - progressRatio, 3);
            const current = progress._animation.startValue
                + (progress._animation.target - progress._animation.startValue) * easeOut;

            this.setProgress(progress, Math.round(current * 100) / 100);

            if (progressRatio < 1) {
                progress._animation.id = requestAnimationFrame(animate);
            } else {
                delete progress._animation;
            }
        };

        anim.id = requestAnimationFrame(animate);
    },

    /** 创建一个新的基础进度条 */
    create(options = {}) {
        const container = document.createElement('div');
        container.className = 'candy-progress-container';

        if (options.label) {
            const label = document.createElement('div');
            label.className = 'candy-progress-label';
            label.textContent = options.label;
            container.appendChild(label);
        }

        const progress = document.createElement('div');
        progress.className = 'candy-progress';

        if (options.size) progress.classList.add('candy-progress-' + options.size);
        if (options.variant) progress.classList.add('candy-progress-' + options.variant);
        if (options.striped) progress.classList.add('candy-progress-striped');
        if (options.animated) progress.classList.add('candy-progress-animated');

        if (options.decimal !== undefined) progress.dataset.decimal = options.decimal;
        if (options.valueFormat) progress.dataset.valueFormat = options.valueFormat;

        const bar = document.createElement('div');
        bar.className = 'candy-progress-bar';

        const value = document.createElement('span');
        value.className = 'candy-progress-value';
        bar.appendChild(value);

        progress.appendChild(bar);
        container.appendChild(progress);

        const initialValue = options.value || 0;
        this.setProgress(progress, initialValue);

        if (options.parent) {
            const parent = typeof options.parent === 'string'
                ? document.querySelector(options.parent)
                : options.parent;
            if (parent) parent.appendChild(container);
        }

        return container;
    },

    /** 增量 */
    increment(selector, amount = 10) {
        const current = this.getProgress(selector);
        this.setProgress(selector, current + amount);
    },

    /** 减量 */
    decrement(selector, amount = 10) {
        const current = this.getProgress(selector);
        this.setProgress(selector, current - amount);
    },

    /** 重置为 0 */
    reset(selector) {
        this.setProgress(selector, 0);
    },

    // ============================================================
    // 三、堆叠进度条
    // ============================================================

    /**
     * 创建堆叠进度条
     * @param {Object} options
     * @param {Array} options.bars - [{value, color, label, variant}]
     * @param {string} options.label
     * @param {string} options.parent
     */
    createStacked(options = {}) {
        const container = document.createElement('div');
        container.className = 'candy-progress-container candy-progress-stacked-container';

        if (options.label) {
            const label = document.createElement('div');
            label.className = 'candy-progress-label';
            label.textContent = options.label;
            container.appendChild(label);
        }

        const progress = document.createElement('div');
        progress.className = 'candy-progress candy-progress-stacked';

        const barsData = options.bars || [{ value: 0 }];

        barsData.forEach((barInfo, index) => {
            const barWrap = document.createElement('div');
            barWrap.className = 'candy-progress-stacked-bar';
            barWrap.dataset.index = index;
            barWrap.style.width = (barInfo.value || 0) + '%';

            if (barInfo.variant) barWrap.classList.add('candy-progress-bar-' + barInfo.variant);
            if (barInfo.color) barWrap.style.background = barInfo.color;
            if (barInfo.striped) barWrap.classList.add('candy-progress-striped');

            if (barInfo.label) {
                const labelEl = document.createElement('span');
                labelEl.className = 'candy-progress-stacked-label';
                labelEl.textContent = barInfo.label;
                barWrap.appendChild(labelEl);
            } else {
                const valueEl = document.createElement('span');
                valueEl.className = 'candy-progress-value';
                valueEl.textContent = (barInfo.value || 0) + '%';
                barWrap.appendChild(valueEl);
            }

            progress.appendChild(barWrap);
        });

        container.appendChild(progress);

        if (options.parent) {
            const parent = typeof options.parent === 'string'
                ? document.querySelector(options.parent)
                : options.parent;
            if (parent) parent.appendChild(container);
        }

        return container;
    },

    /**
     * 设置堆叠进度条中某一个子条的进度
     */
    setStackedProgress(selector, index, value) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        const bars = progress.querySelectorAll('.candy-progress-stacked-bar');
        if (!bars[index]) return;

        const clampedValue = Math.max(0, Math.min(100, value));
        bars[index].style.width = clampedValue + '%';
        const valueEl = bars[index].querySelector('.candy-progress-value');
        if (valueEl && !bars[index].querySelector('.candy-progress-stacked-label')) {
            valueEl.textContent = clampedValue + '%';
        }

        progress.dispatchEvent(new CustomEvent('candy-progress-stacked-change', {
            detail: { index, value: clampedValue },
            bubbles: true
        }));
    },

    // ============================================================
    // 四、圆形 / 环形进度条（SVG 实现）
    // ============================================================

    /**
     * 创建环形进度条
     * @param {Object} options
     * @param {number} options.size - 尺寸（像素）
     * @param {number} options.strokeWidth - 线条宽度
     * @param {string} options.color - 前景颜色
     * @param {string} options.bgColor - 背景颜色
     * @param {number} options.value - 初始进度 0-100
     * @param {boolean} options.showValue - 是否显示百分比
     * @param {string} options.label - 标题
     * @param {string} options.parent
     * @param {boolean} options.animated - 是否动画填充
     * @param {number} options.duration - 动画时长
     */
    createCircular(options = {}) {
        const container = document.createElement('div');
        container.className = 'candy-progress-circular-container';
        container.style.textAlign = 'center';

        if (options.label) {
            const label = document.createElement('div');
            label.className = 'candy-progress-label';
            label.textContent = options.label;
            container.appendChild(label);
        }

        const size = options.size || 120;
        const strokeWidth = options.strokeWidth || 10;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const value = options.value || 0;

        const circular = document.createElement('div');
        circular.className = 'candy-progress-circular';
        circular.dataset.circumference = circumference;
        circular.dataset.size = size;
        circular.dataset.strokeWidth = strokeWidth;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

        // 背景圆环
        const bgCircle = document.createElementNS(svgNS, 'circle');
        bgCircle.setAttribute('cx', size / 2);
        bgCircle.setAttribute('cy', size / 2);
        bgCircle.setAttribute('r', radius);
        bgCircle.setAttribute('fill', 'none');
        bgCircle.setAttribute('stroke', options.bgColor || '#e0e0e0');
        bgCircle.setAttribute('stroke-width', strokeWidth);
        svg.appendChild(bgCircle);

        // 前景圆环
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', size / 2);
        circle.setAttribute('cy', size / 2);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', options.color || '#667eea');
        circle.setAttribute('stroke-width', strokeWidth);
        circle.setAttribute('stroke-linecap', 'round');
        circle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
        circle.setAttribute('stroke-dasharray', circumference);
        circle.setAttribute('stroke-dashoffset', circumference);
        circle.classList.add('candy-progress-circular-bar');
        svg.appendChild(circle);

        circular.appendChild(svg);

        // 中央文字
        if (options.showValue !== false) {
            const text = document.createElement('div');
            text.className = 'candy-progress-circular-value';
            text.style.position = 'absolute';
            text.style.top = '50%';
            text.style.left = '50%';
            text.style.transform = 'translate(-50%, -50%)';
            text.style.fontWeight = 'bold';
            text.style.fontSize = (size / 6) + 'px';
            text.textContent = value + '%';
            circular.appendChild(text);
        }

        circular.style.position = 'relative';
        circular.style.display = 'inline-block';

        container.appendChild(circular);

        if (options.parent) {
            const parent = typeof options.parent === 'string'
                ? document.querySelector(options.parent)
                : options.parent;
            if (parent) parent.appendChild(container);
        }

        // 设置初始进度
        if (options.animated) {
            this.animateCircular(circular, value, options.duration || 1000);
        } else {
            this.setCircularProgress(circular, value);
        }

        return container;
    },

    /** 设置环形进度 */
    setCircularProgress(selector, value) {
        const container = this._resolveEl(selector);
        if (!container) return;

        const circular = container.classList.contains('candy-progress-circular')
            ? container
            : container.querySelector('.candy-progress-circular');
        if (!circular) return;

        const clampedValue = Math.max(0, Math.min(100, value));
        const circumference = parseFloat(circular.dataset.circumference);
        const bar = circular.querySelector('.candy-progress-circular-bar');
        const textEl = circular.querySelector('.candy-progress-circular-value');

        if (bar) {
            const offset = circumference - (clampedValue / 100) * circumference;
            bar.style.transition = 'stroke-dashoffset 0.5s ease';
            bar.setAttribute('stroke-dashoffset', offset);
        }
        if (textEl) textEl.textContent = clampedValue + '%';

        circular.dispatchEvent(new CustomEvent('candy-progress-circular-change', {
            detail: { value: clampedValue },
            bubbles: true
        }));
    },

    /** 环形动画（从 0 动画到目标值） */
    animateCircular(circular, targetValue, duration = 1000) {
        const circumference = parseFloat(circular.dataset.circumference);
        const bar = circular.querySelector('.candy-progress-circular-bar');
        const textEl = circular.querySelector('.candy-progress-circular-value');
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const ratio = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - ratio, 3);
            const current = targetValue * easeOut;

            if (bar) {
                const offset = circumference - (current / 100) * circumference;
                bar.setAttribute('stroke-dashoffset', offset);
            }
            if (textEl) textEl.textContent = Math.round(current) + '%';

            if (ratio < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    },

    // ============================================================
    // 五、标签增强
    // ============================================================

    /** 显示百分比标签（若不存在则自动创建） */
    showValueLabel(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        let valueEl = progress.querySelector('.candy-progress-value');
        if (!valueEl) {
            valueEl = document.createElement('span');
            valueEl.className = 'candy-progress-value';
            const bar = progress.querySelector('.candy-progress-bar');
            if (bar) bar.appendChild(valueEl);
        }
        valueEl.style.display = '';
        this.updateValueDisplay(progress, this.getProgress(progress));
    },

    /**
     * 显示自定义文本
     * @param {*} selector
     * @param {string} format - 例如 "已完成 {value}%"
     */
    showTextLabel(selector, format) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        if (format) progress.dataset.valueFormat = format;
        this.showValueLabel(progress);
    },

    // ============================================================
    // 六、不确定状态
    // ============================================================

    /** 设置为不确定状态（无限动画） */
    setIndeterminate(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        progress.classList.add('candy-progress-indeterminate');
    },

    /** 取消不确定状态，设置为某个确定值 */
    setDeterminate(selector, value) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        progress.classList.remove('candy-progress-indeterminate');
        if (value !== undefined) this.setProgress(progress, value);
    },

    /** 切换不确定 / 确定状态 */
    toggleIndeterminate(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        if (progress.classList.contains('candy-progress-indeterminate')) {
            this.setDeterminate(progress);
        } else {
            this.setIndeterminate(progress);
        }
    },

    // ============================================================
    // 七、步进控制
    // ============================================================

    /** 设置总步数（步进控制） */
    setStep(selector, step) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        progress.dataset.step = step;
        if (progress.dataset.currentStep === undefined) {
            progress.dataset.currentStep = 0;
        }
        this.setProgress(progress, 0);
    },

    /** 下一步 */
    nextStep(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        const total = parseInt(progress.dataset.step) || 1;
        let current = parseInt(progress.dataset.currentStep) || 0;
        current = Math.min(total, current + 1);
        progress.dataset.currentStep = current;
        const value = (current / total) * 100;
        this.setProgress(progress, value);
        return current;
    },

    /** 上一步 */
    prevStep(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        const total = parseInt(progress.dataset.step) || 1;
        let current = parseInt(progress.dataset.currentStep) || 0;
        current = Math.max(0, current - 1);
        progress.dataset.currentStep = current;
        const value = (current / total) * 100;
        this.setProgress(progress, value);
        return current;
    },

    /** 获取当前步骤 */
    getStep(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return 0;
        return parseInt(progress.dataset.currentStep) || 0;
    },

    // ============================================================
    // 八、事件系统
    // ============================================================

    /** 进度开始回调 */
    onProgressStart(selector, callback) {
        const progress = this._resolveEl(selector);
        if (!progress || typeof callback !== 'function') return;
        progress.addEventListener('candy-progress-start', (e) => callback(e.detail));
    },

    /** 进度变化回调 */
    onProgressChange(selector, callback) {
        const progress = this._resolveEl(selector);
        if (!progress || typeof callback !== 'function') return;
        progress.addEventListener('candy-progress-change', (e) => callback(e.detail));
    },

    /** 进度完成回调 */
    onProgressComplete(selector, callback) {
        const progress = this._resolveEl(selector);
        if (!progress || typeof callback !== 'function') return;
        progress.addEventListener('candy-progress-complete', (e) => callback(e.detail));
    },

    // ============================================================
    // 九、自动颜色变化
    // ============================================================

    /**
     * 启用自动颜色变化
     * @param {*} selector
     * @param {Object} thresholds - { low: '颜色', medium: '颜色', high: '颜色' }
     *                             或 { low: {color, threshold}, ... }
     */
    enableAutoColor(selector, thresholds) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        const defaultThresholds = {
            low: '#4facfe',    // 低进度颜色
            medium: '#f7b733', // 中等进度颜色
            high: '#11998e'    // 高进度颜色
        };
        const merged = Object.assign({}, defaultThresholds, thresholds || {});

        progress.dataset.autoColor = 'true';
        progress.dataset.colorLow = typeof merged.low === 'object' ? JSON.stringify(merged.low) : merged.low;
        progress.dataset.colorMedium = typeof merged.medium === 'object' ? JSON.stringify(merged.medium) : merged.medium;
        progress.dataset.colorHigh = typeof merged.high === 'object' ? JSON.stringify(merged.high) : merged.high;

        // 立即应用一次
        this._applyAutoColor(progress, this.getProgress(progress));
    },

    /** 内部：根据进度值应用颜色 */
    _applyAutoColor(progress, value) {
        const bar = progress.querySelector('.candy-progress-bar');
        if (!bar) return;

        let color;
        if (value < 33) {
            color = progress.dataset.colorLow;
        } else if (value < 66) {
            color = progress.dataset.colorMedium;
        } else {
            color = progress.dataset.colorHigh;
        }
        if (!color) return;

        try {
            // 若是 JSON 字符串，解析出 color/threshold
            const parsed = JSON.parse(color);
            if (parsed && parsed.color) {
                bar.style.background = parsed.color;
                return;
            }
        } catch (e) { /* 不是 JSON，按字符串颜色处理 */ }

        bar.style.background = color;
    },

    // ============================================================
    // 十、动画控制（暂停/恢复/停止/从一个值动画到另一个值）
    // ============================================================

    /** 从 from 动画到 to */
    animateFromTo(selector, from, to, duration = 1000) {
        const progress = this._resolveEl(selector);
        if (!progress) return;

        this.setProgress(progress, from);
        // 下一帧开始动画到 to
        requestAnimationFrame(() => {
            this.animateTo(progress, to, duration);
        });
    },

    /** 取消已存在的动画 */
    _cancelExistingAnimation(progress) {
        if (progress._animation && progress._animation.id) {
            cancelAnimationFrame(progress._animation.id);
        }
        delete progress._animation;
    },

    /** 暂停动画 */
    pauseAnimation(selector) {
        const progress = this._resolveEl(selector);
        if (!progress || !progress._animation || progress._animation.paused) return;

        progress._animation.paused = true;
        progress._animation.pausedAt = performance.now();
    },

    /** 恢复动画 */
    resumeAnimation(selector) {
        const progress = this._resolveEl(selector);
        if (!progress || !progress._animation || !progress._animation.paused) return;

        // 累加本次暂停的时长到 pauseTotal
        progress._animation.pauseTotal += performance.now() - progress._animation.pausedAt;
        progress._animation.paused = false;
    },

    /** 停止动画（保持当前值） */
    stopAnimation(selector) {
        const progress = this._resolveEl(selector);
        if (!progress) return;
        this._cancelExistingAnimation(progress);
    },

    // ============================================================
    // 十一、数据绑定
    // ============================================================

    /**
     * 绑定到输入框，输入框变化会同步更新进度条
     */
    bindToInput(progressSelector, inputSelector) {
        const progress = this._resolveEl(progressSelector);
        const input = this._resolveEl(inputSelector);
        if (!progress || !input) return;

        // 输入框变化时更新进度条
        const syncFromInput = () => {
            const v = parseFloat(input.value);
            if (!isNaN(v)) this.setProgress(progress, v);
        };
        input.addEventListener('input', syncFromInput);
        input.addEventListener('change', syncFromInput);

        // 进度条变化时同步输入框
        progress.addEventListener('candy-progress-change', (e) => {
            if (document.activeElement !== input) {
                input.value = e.detail.value;
            }
        });

        // 初始化同步
        syncFromInput();
    }
};

// DOM 就绪后自动初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyProgress.init();
});
