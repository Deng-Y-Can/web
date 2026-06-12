/**
 * CandyUI - 工具提示组件
 * 功能完整的提示气泡组件，支持3D效果和多种动画
 */

const CandyTooltip = {
    // 存储所有工具提示实例
    instances: new Map(),
    // 默认配置
    defaultConfig: {
        position: 'top',
        delay: 0,
        duration: 3000,
        theme: 'default',
        animation: 'fade',
        allowHTML: false,
        interactive: false
    },
    // 全局配置
    globalConfig: {
        position: 'top',
        delay: 200,
        duration: 3000
    },

    /**
     * 初始化所有工具提示
     */
    init() {
        // 查找所有带有 data-tooltip 属性的元素
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            this.bind(element, element.getAttribute('data-tooltip'));
        });
    },

    /**
     * 绑定工具提示到元素
     * @param {HTMLElement} target - 目标元素
     * @param {string} content - 提示内容
     * @param {Object} options - 配置选项
     */
    bind(target, content, options = {}) {
        if (!target || !content) return;

        const config = { ...this.defaultConfig, ...this.globalConfig, ...options };
        
        // 创建工具提示元素
        const tooltip = document.createElement('div');
        tooltip.className = 'candy-tooltip';
        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);
        
        // 添加位置类
        tooltip.classList.add(`tooltip-${config.position}`);
        
        // 添加样式类
        if (config.theme && config.theme !== 'default') {
            tooltip.classList.add(`tooltip-${config.theme}`);
        }

        // 创建实例
        const instance = {
            element: target,
            tooltip: tooltip,
            content: content,
            config: config,
            timeout: null
        };

        this.instances.set(target, instance);

        // 鼠标事件
        target.addEventListener('mouseenter', () => this.show(target));
        target.addEventListener('mouseleave', () => this.hide(target));
        
        // 触摸事件
        target.addEventListener('touchstart', () => this.show(target), { passive: true });
        target.addEventListener('touchend', () => this.hide(target), { passive: true });

        // 点击事件（如果启用交互）
        if (config.interactive) {
            target.addEventListener('click', () => {
                if (tooltip.classList.contains('active')) {
                    this.hide(target);
                } else {
                    this.show(target);
                }
            });
        }
    },

    /**
     * 显示工具提示
     * @param {HTMLElement} target - 目标元素
     */
    show(target) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip, config } = instance;

        // 清除之前的定时器
        if (instance.timeout) {
            clearTimeout(instance.timeout);
        }

        // 延迟显示
        instance.timeout = setTimeout(() => {
            // 计算位置
            this.updatePosition(target);
            
            // 显示提示
            tooltip.classList.add('active');
            
            // 触发显示事件
            target.dispatchEvent(new CustomEvent('candy-tooltip-show', {
                bubbles: true,
                detail: { tooltip: tooltip }
            }));

            // 自动隐藏
            if (config.duration > 0) {
                instance.hideTimeout = setTimeout(() => {
                    this.hide(target);
                }, config.duration);
            }
        }, config.delay);
    },

    /**
     * 隐藏工具提示
     * @param {HTMLElement} target - 目标元素
     */
    hide(target) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip } = instance;

        // 清除定时器
        if (instance.timeout) {
            clearTimeout(instance.timeout);
        }
        if (instance.hideTimeout) {
            clearTimeout(instance.hideTimeout);
        }

        // 隐藏提示
        tooltip.classList.remove('active');
        
        // 触发隐藏事件
        target.dispatchEvent(new CustomEvent('candy-tooltip-hide', {
            bubbles: true,
            detail: { tooltip: tooltip }
        }));
    },

    /**
     * 切换工具提示
     * @param {HTMLElement} target - 目标元素
     * @param {string} content - 提示内容（可选）
     */
    toggle(target, content) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const tooltip = instance.tooltip;
        
        if (tooltip.classList.contains('active')) {
            this.hide(target);
        } else {
            if (content) {
                this.setContent(target, content);
            }
            this.show(target);
        }
    },

    /**
     * 创建工具提示
     * @param {Object} options - 创建选项
     * @returns {HTMLElement} - 创建的工具提示元素
     */
    create(options = {}) {
        const {
            id = `tooltip-${Date.now()}`,
            content = '',
            position = 'top',
            theme = 'default',
            delay = 0,
            duration = 3000,
            target = null,
            onShow,
            onHide,
            onClick
        } = options;

        // 创建提示元素
        const tooltip = document.createElement('div');
        tooltip.id = id;
        tooltip.className = `candy-tooltip tooltip-${position}`;
        tooltip.innerHTML = content;
        
        if (theme !== 'default') {
            tooltip.classList.add(`tooltip-${theme}`);
        }

        document.body.appendChild(tooltip);

        // 如果提供了目标元素
        if (target) {
            this.bind(target, content, {
                position,
                theme,
                delay,
                duration
            });
        }

        // 绑定事件
        if (onShow) {
            tooltip.addEventListener('candy-tooltip-show', onShow);
        }
        if (onHide) {
            tooltip.addEventListener('candy-tooltip-hide', onHide);
        }
        if (onClick) {
            tooltip.addEventListener('click', onClick);
        }

        return tooltip;
    },

    /**
     * 设置提示内容
     * @param {HTMLElement} target - 目标元素
     * @param {string} content - 提示内容
     */
    setContent(target, content) {
        const instance = this.instances.get(target);
        if (!instance) return;

        instance.content = content;
        instance.tooltip.innerHTML = content;
    },

    /**
     * 设置位置
     * @param {HTMLElement} target - 目标元素
     * @param {string} position - 位置 (top/bottom/left/right)
     */
    setPosition(target, position) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip, config } = instance;

        // 移除旧位置类
        tooltip.classList.remove(`tooltip-${config.position}`);
        
        // 添加新位置类
        tooltip.classList.add(`tooltip-${position}`);
        
        // 更新配置
        instance.config.position = position;
        
        // 重新计算位置
        if (tooltip.classList.contains('active')) {
            this.updatePosition(target);
        }
    },

    /**
     * 设置延迟
     * @param {HTMLElement} target - 目标元素
     * @param {number} delay - 延迟时间（毫秒）
     */
    setDelay(target, delay) {
        const instance = this.instances.get(target);
        if (!instance) return;

        instance.config.delay = delay;
    },

    /**
     * 设置显示时长
     * @param {HTMLElement} target - 目标元素
     * @param {number} duration - 显示时长（毫秒），0表示不自动隐藏
     */
    setDuration(target, duration) {
        const instance = this.instances.get(target);
        if (!instance) return;

        instance.config.duration = duration;
    },

    /**
     * 设置主题
     * @param {HTMLElement} target - 目标元素
     * @param {string} theme - 主题名称
     */
    setTheme(target, theme) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip, config } = instance;

        // 移除旧主题类
        if (config.theme && config.theme !== 'default') {
            tooltip.classList.remove(`tooltip-${config.theme}`);
        }
        
        // 添加新主题类
        if (theme !== 'default') {
            tooltip.classList.add(`tooltip-${theme}`);
        }
        
        // 更新配置
        instance.config.theme = theme;
    },

    /**
     * 更新位置
     * @param {HTMLElement} target - 目标元素
     */
    updatePosition(target) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip, config } = instance;
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top, left;

        switch (config.position) {
            case 'top':
                top = rect.top - tooltipRect.height - 15;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 15;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 15;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 15;
                break;
            default:
                top = rect.top - tooltipRect.height - 15;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
        }

        // 确保不超出视口
        const padding = 10;
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
        top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    },

    /**
     * 启用3D效果
     * @param {HTMLElement} target - 目标元素
     */
    enable3D(target) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip } = instance;
        
        // 设置透视
        tooltip.style.perspective = '1000px';
        
        // 添加3D变换
        if (!tooltip.classList.contains('tooltip-5')) {
            tooltip.style.transform = 'perspective(1000px) rotateX(10deg)';
        }
    },

    /**
     * 设置发光颜色
     * @param {HTMLElement} target - 目标元素
     * @param {string} color - 发光颜色
     */
    setGlow(target, color = '#667eea') {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip } = instance;
        
        tooltip.style.boxShadow = `
            0 0 10px ${color},
            0 0 20px ${color}80,
            0 0 30px ${color}40
        `;
    },

    /**
     * 设置动画
     * @param {HTMLElement} target - 目标元素
     * @param {string} animation - 动画类型
     */
    setAnimation(target, animation) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip, config } = instance;

        // 移除旧动画类
        tooltip.classList.remove(
            'tooltip-21', 'tooltip-22', 'tooltip-23', 'tooltip-24', 'tooltip-25',
            'tooltip-26', 'tooltip-27', 'tooltip-28', 'tooltip-29', 'tooltip-30'
        );
        
        // 添加新动画类
        tooltip.classList.add(`tooltip-${animation}`);
        
        // 更新配置
        instance.config.animation = animation;
    },

    /**
     * 显示时回调
     * @param {Function} callback - 回调函数
     */
    onShow(callback) {
        document.addEventListener('candy-tooltip-show', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 隐藏时回调
     * @param {Function} callback - 回调函数
     */
    onHide(callback) {
        document.addEventListener('candy-tooltip-hide', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 点击时回调
     * @param {Function} callback - 回调函数
     */
    onClick(callback) {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('candy-tooltip')) {
                callback(e);
            }
        });
    },

    /**
     * 启用所有工具提示
     */
    enableAll() {
        this.instances.forEach((instance, target) => {
            this.bind(target, instance.content, instance.config);
        });
    },

    /**
     * 禁用所有工具提示
     */
    disableAll() {
        this.instances.forEach((instance) => {
            instance.tooltip.style.display = 'none';
        });
    },

    /**
     * 销毁工具提示
     * @param {HTMLElement} target - 目标元素
     */
    destroy(target) {
        const instance = this.instances.get(target);
        if (!instance) return;

        const { tooltip } = instance;
        
        // 移除提示元素
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
        
        // 移除实例
        this.instances.delete(target);
    },

    /**
     * 销毁所有工具提示
     */
    destroyAll() {
        this.instances.forEach((instance) => {
            const { tooltip } = instance;
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
        
        this.instances.clear();
    },

    /**
     * 全局配置
     * @param {Object} options - 配置选项
     */
    config(options) {
        this.globalConfig = { ...this.globalConfig, ...options };
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyTooltip.init();
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyTooltip;
}