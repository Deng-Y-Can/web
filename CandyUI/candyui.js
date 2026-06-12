/**
 * CandyUI - 统一组件交互库 v1.0
 * 提供进度条、滑块、下拉框等组件的交互功能
 */

const CandyUI = {
    /**
     * 初始化所有CandyUI组件
     */
    init() {
        this.initProgressBars();
        this.initSliders();
        this.initDropdowns();
    },

    /**
     * 进度条交互功能
     * @param {string|HTMLElement} container - 进度条容器或选择器
     */
    initProgressBars(container) {
        const progressBars = container 
            ? (typeof container === 'string' ? document.querySelectorAll(container) : [container])
            : document.querySelectorAll('.candy-progress[data-auto]');

        progressBars.forEach(bar => {
            const progressValue = bar.getAttribute('data-progress') || 0;
            const progressElement = bar.querySelector('.candy-progress-bar');
            if (progressElement) {
                progressElement.style.width = progressValue + '%';
                progressElement.setAttribute('data-progress', progressValue + '%');
            }
        });
    },

    /**
     * 初始化可拖动进度条
     * @param {string|HTMLElement} bar - 进度条元素
     * @param {Function} callback - 值变化回调函数
     */
    initDraggableProgress(bar, callback) {
        const progressBar = typeof bar === 'string' ? document.querySelector(bar) : bar;
        if (!progressBar) return;

        // 确保进度条有candy-progress类
        if (!progressBar.classList.contains('candy-progress')) {
            progressBar.classList.add('candy-progress');
        }

        let isDragging = false;

        // 创建或获取滑块
        let thumb = progressBar.querySelector('.candy-progress-thumb');
        if (!thumb) {
            thumb = document.createElement('div');
            thumb.className = 'candy-progress-thumb';
            progressBar.appendChild(thumb);
        }

        const updateProgress = (clientX) => {
            const rect = progressBar.getBoundingClientRect();
            let percentage = ((clientX - rect.left) / rect.width) * 100;
            percentage = Math.max(0, Math.min(100, percentage));
            this.setProgress(progressBar, percentage);
            
            if (callback) {
                callback(percentage);
            }
            
            progressBar.dispatchEvent(new CustomEvent('candy-change', {
                detail: { value: percentage }
            }));
        };

        // 鼠标事件
        progressBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            progressBar.style.cursor = 'grabbing';
            updateProgress(e.clientX);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateProgress(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                progressBar.style.cursor = '';
            }
        });

        // 触摸事件
        progressBar.addEventListener('touchstart', (e) => {
            isDragging = true;
            updateProgress(e.touches[0].clientX);
        });

        progressBar.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                updateProgress(e.touches[0].clientX);
            }
        });

        progressBar.addEventListener('touchend', () => {
            isDragging = false;
        });
    },

    /**
     * 设置进度条值
     * @param {string|HTMLElement} bar - 进度条元素
     * @param {number} value - 进度值 (0-100)
     */
    setProgress(bar, value) {
        const progressBar = typeof bar === 'string' ? document.querySelector(bar) : bar;
        const progressElement = progressBar.querySelector('.candy-progress-bar');
        const thumb = progressBar.querySelector('.candy-progress-thumb');
        if (progressElement) {
            value = Math.max(0, Math.min(100, value));
            progressElement.style.width = value + '%';
            progressElement.setAttribute('data-progress', value + '%');
        }
        if (thumb) {
            thumb.style.left = value + '%';
        }
    },

    /**
     * 获取进度条值
     * @param {string|HTMLElement} bar - 进度条元素
     * @returns {number} 进度值
     */
    getProgress(bar) {
        const progressBar = typeof bar === 'string' ? document.querySelector(bar) : bar;
        const progressElement = progressBar.querySelector('.candy-progress-bar');
        return progressElement ? parseInt(progressElement.getAttribute('data-progress')) || 0 : 0;
    },

    /**
     * 滑块交互功能
     * @param {string|HTMLElement} slider - 滑块元素或选择器
     * @param {Function} callback - 值变化回调函数
     */
    initSliders(slider, callback) {
        const sliders = slider 
            ? (typeof slider === 'string' ? document.querySelectorAll(slider) : [slider])
            : document.querySelectorAll('.candy-slider');

        sliders.forEach(s => {
            // 初始化滑块值显示
            const valueDisplay = s.parentElement.querySelector('.candy-slider-value');
            if (valueDisplay) {
                valueDisplay.textContent = s.value;
            }

            // 监听值变化
            s.addEventListener('input', (e) => {
                const value = e.target.value;
                const min = e.target.min || 0;
                const max = e.target.max || 100;
                const percentage = ((value - min) / (max - min)) * 100;

                // 更新值显示
                if (valueDisplay) {
                    valueDisplay.textContent = value;
                }

                // 更新滑块轨道渐变
                e.target.style.background = `linear-gradient(to right, var(--candy-primary) 0%, var(--candy-primary) ${percentage}%, #e0e0e0 ${percentage}%, #e0e0e0 100%)`;

                // 执行回调
                if (callback) {
                    callback(value, e);
                }

                // 触发自定义事件
                s.dispatchEvent(new CustomEvent('candy-change', { 
                    detail: { value, percentage } 
                }));
            });
        });
    },

    /**
     * 获取滑块值
     * @param {string|HTMLElement} slider - 滑块元素
     * @returns {number} 滑块值
     */
    getSliderValue(slider) {
        const s = typeof slider === 'string' ? document.querySelector(slider) : slider;
        return s ? parseFloat(s.value) : 0;
    },

    /**
     * 设置滑块值
     * @param {string|HTMLElement} slider - 滑块元素
     * @param {number} value - 要设置的值
     */
    setSliderValue(slider, value) {
        const s = typeof slider === 'string' ? document.querySelector(slider) : slider;
        if (s) {
            s.value = value;
            s.dispatchEvent(new Event('input'));
        }
    },

    /**
     * 下拉框交互功能
     * @param {string|HTMLElement} select - 下拉框元素或选择器
     * @param {Function} callback - 选择变化回调函数
     */
    initDropdowns(select, callback) {
        const selects = select 
            ? (typeof select === 'string' ? document.querySelectorAll(select) : [select])
            : document.querySelectorAll('.candy-select select');

        selects.forEach(s => {
            s.addEventListener('change', (e) => {
                if (callback) {
                    callback(e.target.value, e);
                }

                // 触发自定义事件
                s.dispatchEvent(new CustomEvent('candy-change', { 
                    detail: { value: e.target.value } 
                }));
            });
        });
    },

    /**
     * 获取下拉框选中值
     * @param {string|HTMLElement} select - 下拉框元素
     * @returns {string} 选中的值
     */
    getDropdownValue(select) {
        const s = typeof select === 'string' ? document.querySelector(select) : select;
        return s ? s.value : '';
    },

    /**
     * 设置下拉框选中值
     * @param {string|HTMLElement} select - 下拉框元素
     * @param {string} value - 要设置的值
     */
    setDropdownValue(select, value) {
        const s = typeof select === 'string' ? document.querySelector(select) : select;
        if (s) {
            s.value = value;
            s.dispatchEvent(new Event('change'));
        }
    },

    /**
     * 创建进度条
     * @param {Object} options - 配置选项
     * @returns {HTMLElement} 进度条元素
     */
    createProgressBar(options = {}) {
        const {
            id = '',
            value = 0,
            max = 100,
            animated = false,
            striped = false,
            showLabel = true,
            className = ''
        } = options;

        const container = document.createElement('div');
        container.className = `candy-progress ${animated ? 'candy-progress-animated' : ''} ${striped ? 'candy-progress-striped' : ''} ${className}`;
        container.id = id;

        const bar = document.createElement('div');
        bar.className = 'candy-progress-bar';
        bar.style.width = value + '%';
        bar.setAttribute('data-progress', value + '%');

        container.appendChild(bar);
        return container;
    },

    /**
     * 创建滑块
     * @param {Object} options - 配置选项
     * @returns {HTMLElement} 滑块容器元素
     */
    createSlider(options = {}) {
        const {
            id = '',
            min = 0,
            max = 100,
            value = 50,
            step = 1,
            showValue = true,
            className = ''
        } = options;

        const container = document.createElement('div');
        container.className = `candy-slider-container ${className}`;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'candy-slider';
        slider.id = id;
        slider.min = min;
        slider.max = max;
        slider.value = value;
        slider.step = step;

        // 设置初始样式
        const percentage = ((value - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, var(--candy-primary) 0%, var(--candy-primary) ${percentage}%, #e0e0e0 ${percentage}%, #e0e0e0 100%)`;

        container.appendChild(slider);

        if (showValue) {
            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'candy-slider-value';
            valueDisplay.textContent = value;
            container.appendChild(valueDisplay);
        }

        // 初始化交互
        this.initSliders(slider);

        return container;
    },

    /**
     * 创建下拉框
     * @param {Object} options - 配置选项
     * @returns {HTMLElement} 下拉框容器元素
     */
    createDropdown(options = {}) {
        const {
            id = '',
            options: optionList = [],
            placeholder = '请选择',
            className = ''
        } = options;

        const container = document.createElement('div');
        container.className = `candy-select ${className}`;

        const select = document.createElement('select');
        select.id = id;

        if (placeholder) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = placeholder;
            defaultOption.disabled = true;
            defaultOption.selected = true;
            select.appendChild(defaultOption);
        }

        optionList.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value || opt;
            option.textContent = opt.label || opt;
            select.appendChild(option);
        });

        container.appendChild(select);

        // 初始化交互
        this.initDropdowns(select);

        return container;
    }
};

// 自动初始化
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        CandyUI.init();
    });
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyUI;
}