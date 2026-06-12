/**
 * CandyUI - 消息提示组件
 * 功能完整的通知提示组件，支持3D效果和多种动画
 */

const CandyToast = {
    // 存储所有消息提示实例
    instances: new Map(),
    // 容器引用
    container: null,
    // 默认配置
    defaultConfig: {
        position: 'top-right',
        duration: 3000,
        type: 'info',
        style: 'default',
        showIcon: true,
        showClose: true,
        showProgress: true,
        animation: 'slide',
        maxCount: 5
    },
    // 全局配置
    globalConfig: {
        position: 'top-right',
        duration: 3000
    },
    // 计数器
    counter: 0,

    /**
     * 显示消息提示
     * @param {string} message - 消息内容
     * @param {Object} options - 配置选项
     */
    show(message, options = {}) {
        const config = { ...this.defaultConfig, ...this.globalConfig, ...options };
        const id = `toast-${++this.counter}`;
        
        // 创建容器
        if (!this.container) {
            this.createContainer(config.position);
        }

        // 创建消息元素
        const toast = document.createElement('div');
        toast.className = `candy-toast toast-${config.type} toast-${config.style}`;
        toast.id = id;
        
        // 图标
        let iconHtml = '';
        if (config.showIcon) {
            iconHtml = `<span class="candy-toast-icon">${this.getIcon(config.type)}</span>`;
        }
        
        // 关闭按钮
        let closeHtml = '';
        if (config.showClose) {
            closeHtml = `<button class="candy-toast-close" onclick="CandyToast.dismiss('${id}')">×</button>`;
        }
        
        // 进度条
        let progressHtml = '';
        if (config.showProgress && config.duration > 0) {
            progressHtml = `<div class="candy-toast-progress" style="width: 100%; transition: width ${config.duration}ms linear;"></div>`;
        }
        
        toast.innerHTML = `
            ${iconHtml}
            <div class="candy-toast-content">${message}</div>
            ${closeHtml}
            ${progressHtml}
        `;
        
        // 添加到容器
        this.container.appendChild(toast);
        
        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('show');
            
            // 开始进度条动画
            if (config.showProgress && config.duration > 0) {
                const progress = toast.querySelector('.candy-toast-progress');
                if (progress) {
                    requestAnimationFrame(() => {
                        progress.style.width = '0%';
                    });
                }
            }
        });
        
        // 创建实例
        const instance = {
            id: id,
            element: toast,
            config: config,
            timeout: null
        };
        
        this.instances.set(id, instance);
        
        // 自动关闭
        if (config.duration > 0) {
            instance.timeout = setTimeout(() => {
                this.dismiss(id);
            }, config.duration);
        }
        
        // 限制最大数量
        this.limitCount();
        
        // 触发显示事件
        toast.dispatchEvent(new CustomEvent('candy-toast-show', {
            bubbles: true,
            detail: instance
        }));
        
        return id;
    },

    /**
     * 显示成功消息
     */
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    },

    /**
     * 显示错误消息
     */
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    },

    /**
     * 显示警告消息
     */
    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    },

    /**
     * 显示信息消息
     */
    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    },

    /**
     * 显示加载消息
     */
    loading(message, options = {}) {
        return this.show(message, { ...options, type: 'loading' });
    },

    /**
     * 创建消息提示
     */
    create(options = {}) {
        const {
            message = '',
            type = 'info',
            style = 'default',
            position,
            duration,
            showIcon = true,
            showClose = true,
            showProgress = true,
            onShow,
            onHide,
            onClick,
            onClose
        } = options;

        const id = this.show(message, {
            type,
            style,
            position,
            duration,
            showIcon,
            showClose,
            showProgress
        });

        const instance = this.instances.get(id);
        
        if (instance) {
            if (onShow) {
                instance.element.addEventListener('candy-toast-show', onShow);
            }
            if (onHide) {
                instance.element.addEventListener('candy-toast-hide', onHide);
            }
            if (onClick) {
                instance.element.addEventListener('click', onClick);
            }
            if (onClose) {
                instance.element.addEventListener('candy-toast-close', onClose);
            }
        }

        return id;
    },

    /**
     * 关闭消息提示
     */
    dismiss(id) {
        const instance = this.instances.get(id);
        if (!instance) return;

        const { element, timeout } = instance;
        
        // 清除定时器
        if (timeout) {
            clearTimeout(timeout);
        }
        
        // 移除显示类
        element.classList.remove('show');
        
        // 触发关闭事件
        element.dispatchEvent(new CustomEvent('candy-toast-close', {
            bubbles: true,
            detail: instance
        }));
        
        // 延迟移除元素
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.instances.delete(id);
            
            // 触发隐藏事件
            element.dispatchEvent(new CustomEvent('candy-toast-hide', {
                bubbles: true,
                detail: instance
            }));
        }, 300);
    },

    /**
     * 关闭所有消息提示
     */
    dismissAll() {
        this.instances.forEach((instance, id) => {
            this.dismiss(id);
        });
    },

    /**
     * 创建容器
     */
    createContainer(position) {
        // 移除旧容器
        if (this.container) {
            this.container.remove();
        }
        
        // 创建新容器
        this.container = document.createElement('div');
        this.container.className = `candy-toast-container position-${position}`;
        document.body.appendChild(this.container);
    },

    /**
     * 设置位置
     */
    setPosition(position) {
        if (this.container) {
            this.container.className = `candy-toast-container position-${position}`;
        }
    },

    /**
     * 设置显示时长
     */
    setDuration(duration) {
        this.globalConfig.duration = duration;
    },

    /**
     * 设置主题
     */
    setTheme(theme) {
        this.globalConfig.style = theme;
    },

    /**
     * 设置图标
     */
    setIcon(icon) {
        this.globalConfig.icon = icon;
    },

    /**
     * 设置是否显示进度条
     */
    setProgress(enabled) {
        this.globalConfig.showProgress = enabled;
    },

    /**
     * 启用3D效果
     */
    enable3D() {
        this.globalConfig.style = 'default';
    },

    /**
     * 设置动画
     */
    setAnimation(animation) {
        this.globalConfig.animation = animation;
    },

    /**
     * 设置发光颜色
     */
    setGlow(color = '#667eea') {
        if (this.container) {
            this.container.style.setProperty('--toast-glow', color);
        }
    },

    /**
     * 显示时回调
     */
    onShow(callback) {
        document.addEventListener('candy-toast-show', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 隐藏时回调
     */
    onHide(callback) {
        document.addEventListener('candy-toast-hide', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 点击时回调
     */
    onClick(callback) {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.candy-toast')) {
                callback(e);
            }
        });
    },

    /**
     * 关闭时回调
     */
    onClose(callback) {
        document.addEventListener('candy-toast-close', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 全局配置
     */
    config(options) {
        this.globalConfig = { ...this.globalConfig, ...options };
        
        if (options.position && this.container) {
            this.createContainer(options.position);
        }
    },

    /**
     * 设置最大显示数量
     */
    setMaxCount(count) {
        this.globalConfig.maxCount = count;
        this.limitCount();
    },

    /**
     * 限制数量
     */
    limitCount() {
        const maxCount = this.globalConfig.maxCount;
        const instances = Array.from(this.instances.values());
        
        while (instances.length > maxCount) {
            const oldest = instances.shift();
            this.dismiss(oldest.id);
        }
    },

    /**
     * 清除所有消息
     */
    clear() {
        this.dismissAll();
    },

    /**
     * 获取图标
     */
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
            loading: '↻'
        };
        return icons[type] || icons.info;
    },

    /**
     * 获取所有实例
     */
    getAll() {
        return Array.from(this.instances.values());
    },

    /**
     * 获取实例数量
     */
    getCount() {
        return this.instances.size;
    },

    /**
     * 销毁组件
     */
    destroy() {
        this.dismissAll();
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    // 可以在这里添加自动初始化逻辑
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyToast;
}