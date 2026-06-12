/**
 * CandyUI - 模态框组件
 * 功能完整的模态框/对话框组件，支持3D效果和多种动画
 */

const CandyModal = {
    // 存储所有模态框实例
    instances: new Map(),
    // 当前打开的模态框栈
    activeStack: [],
    // 默认配置
    defaultConfig: {
        animation: 'fade',
        size: 'md',
        position: 'center',
        closeOnOverlay: true,
        closeOnEscape: true,
        showClose: true,
        autoOpen: false
    },

    /**
     * 初始化模态框
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Object} options - 配置选项
     */
    init(selector, options = {}) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) {
            console.error('CandyModal: 模态框元素未找到');
            return;
        }

        const config = { ...this.defaultConfig, ...options };
        
        // 创建实例
        const instance = {
            element: modal,
            config: config,
            isOpen: false
        };

        this.instances.set(this.getInstanceId(modal), instance);
        
        // 绑定事件
        this.bindEvents(instance);
        
        // 如果配置为自动打开
        if (config.autoOpen) {
            this.open(modal);
        }

        return instance;
    },

    /**
     * 获取实例ID
     */
    getInstanceId(element) {
        return element.id || `candy-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * 绑定事件
     */
    bindEvents(instance) {
        const modal = instance.element;
        const config = instance.config;

        // 关闭按钮
        const closeBtn = modal.querySelector('.candy-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(modal));
        }

        // 遮罩层点击
        const overlay = modal.closest('.candy-modal-overlay');
        if (overlay && config.closeOnOverlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close(modal);
                }
            });
        }

        // ESC键关闭
        if (config.closeOnEscape) {
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && instance.isOpen) {
                    this.close(modal);
                }
            });
        }
    },

    /**
     * 打开模态框
     */
    open(selector) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const instanceId = this.getInstanceId(modal);
        const instance = this.instances.get(instanceId);
        
        if (!instance) {
            this.init(modal);
        }

        const overlay = modal.closest('.candy-modal-overlay');
        
        // 添加到栈
        this.activeStack.push(modal);
        
        // 显示遮罩
        if (overlay) {
            overlay.classList.add('active');
        }
        
        // 添加打开状态
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'block';
        
        // 更新实例状态
        if (this.instances.has(instanceId)) {
            this.instances.get(instanceId).isOpen = true;
        }
        
        // 触发打开事件
        modal.dispatchEvent(new CustomEvent('candy-modal-open', {
            bubbles: true,
            detail: { modal }
        }));

        // 聚焦到模态框
        modal.focus();

        // 禁止背景滚动
        document.body.style.overflow = 'hidden';
    },

    /**
     * 关闭模态框
     */
    close(selector) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const instanceId = this.getInstanceId(modal);
        const overlay = modal.closest('.candy-modal-overlay');
        
        // 从栈中移除
        const index = this.activeStack.indexOf(modal);
        if (index > -1) {
            this.activeStack.splice(index, 1);
        }
        
        // 隐藏遮罩
        if (overlay) {
            overlay.classList.remove('active');
        }
        
        // 移除打开状态
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        
        // 更新实例状态
        if (this.instances.has(instanceId)) {
            this.instances.get(instanceId).isOpen = false;
        }
        
        // 延迟隐藏（等待动画完成）
        setTimeout(() => {
            if (!this.instances.get(instanceId)?.isOpen) {
                modal.style.display = 'none';
            }
        }, 300);
        
        // 恢复背景滚动
        if (this.activeStack.length === 0) {
            document.body.style.overflow = '';
        }

        // 触发关闭事件
        modal.dispatchEvent(new CustomEvent('candy-modal-close', {
            bubbles: true,
            detail: { modal }
        }));
    },

    /**
     * 切换模态框
     */
    toggle(selector) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const instanceId = this.getInstanceId(modal);
        const instance = this.instances.get(instanceId);

        if (instance?.isOpen) {
            this.close(modal);
        } else {
            this.open(modal);
        }
    },

    /**
     * 检查模态框是否打开
     */
    isOpen(selector) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return false;

        const instanceId = this.getInstanceId(modal);
        return this.instances.get(instanceId)?.isOpen || false;
    },

    /**
     * 创建模态框
     * @param {Object} options - 创建选项
     */
    create(options = {}) {
        const {
            id = `modal-${Date.now()}`,
            title = '模态框标题',
            content = '',
            footer = '',
            style = 'modal-1',
            size = 'md',
            animation = 'fade',
            onOpen,
            onClose
        } = options;

        // 创建遮罩
        const overlay = document.createElement('div');
        overlay.className = 'candy-modal-overlay';
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = `candy-modal ${style}`;
        modal.id = id;
        modal.tabIndex = -1;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', `${id}-title`);
        
        // 构建内容
        modal.innerHTML = `
            <button class="candy-modal-close" aria-label="关闭">×</button>
            <div class="candy-modal-header" id="${id}-title">${title}</div>
            <div class="candy-modal-body">${content}</div>
            ${footer ? `<div class="candy-modal-footer">${footer}</div>` : ''}
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 初始化
        const instance = this.init(modal, { 
            animation, 
            size,
            onOpen,
            onClose
        });

        // 绑定额外的事件
        if (onOpen) {
            modal.addEventListener('candy-modal-open', onOpen);
        }
        if (onClose) {
            modal.addEventListener('candy-modal-close', onClose);
        }

        return modal;
    },

    /**
     * 确认对话框
     */
    confirm(options = {}) {
        const {
            title = '确认',
            message = '确定要执行此操作吗？',
            confirmText = '确定',
            cancelText = '取消',
            confirmClass = 'primary',
            onConfirm,
            onCancel
        } = options;

        return new Promise((resolve) => {
            const footer = `
                <button class="candy-modal-btn candy-modal-btn-${confirmClass}" data-action="confirm">${confirmText}</button>
                <button class="candy-modal-btn candy-modal-btn-secondary" data-action="cancel">${cancelText}</button>
            `;

            const modal = this.create({
                title,
                content: message,
                footer,
                style: 'modal-1',
                onClose: () => {
                    if (onCancel) onCancel();
                    resolve(false);
                }
            });

            // 绑定按钮事件
            const confirmBtn = modal.querySelector('[data-action="confirm"]');
            const cancelBtn = modal.querySelector('[data-action="cancel"]');

            confirmBtn.addEventListener('click', () => {
                if (onConfirm) onConfirm();
                this.close(modal);
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                if (onCancel) onCancel();
                this.close(modal);
                resolve(false);
            });

            // 打开模态框
            this.open(modal);
        });
    },

    /**
     * 警告框
     */
    alert(options = {}) {
        const {
            title = '提示',
            message = '',
            buttonText = '确定',
            type = 'info',
            onClose
        } = options;

        const typeClass = {
            info: 'info',
            success: 'success',
            warning: 'warning',
            error: 'danger'
        };

        const footer = `
            <button class="candy-modal-btn candy-modal-btn-${typeClass[type] || 'primary'}">${buttonText}</button>
        `;

        const modal = this.create({
            title,
            content: message,
            footer,
            style: 'modal-1',
            onClose
        });

        const btn = modal.querySelector('button');
        btn.addEventListener('click', () => {
            this.close(modal);
            if (onClose) onClose();
        });

        this.open(modal);
        return modal;
    },

    /**
     * 输入对话框
     */
    prompt(options = {}) {
        const {
            title = '输入',
            message = '请输入：',
            defaultValue = '',
            placeholder = '',
            confirmText = '确定',
            cancelText = '取消',
            onConfirm,
            onCancel
        } = options;

        return new Promise((resolve) => {
            const content = `
                <p>${message}</p>
                <input type="text" 
                       class="candy-modal-input" 
                       value="${defaultValue}"
                       placeholder="${placeholder}"
                       style="width: 100%; padding: 12px; margin-top: 15px; border-radius: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; outline: none;">
            `;

            const footer = `
                <button class="candy-modal-btn candy-modal-btn-primary" data-action="confirm">${confirmText}</button>
                <button class="candy-modal-btn candy-modal-btn-secondary" data-action="cancel">${cancelText}</button>
            `;

            const modal = this.create({
                title,
                content,
                footer,
                style: 'modal-1',
                onClose: () => {
                    if (onCancel) onCancel();
                    resolve(null);
                }
            });

            const input = modal.querySelector('input');
            const confirmBtn = modal.querySelector('[data-action="confirm"]');
            const cancelBtn = modal.querySelector('[data-action="cancel"]');

            input.focus();

            confirmBtn.addEventListener('click', () => {
                const value = input.value;
                if (onConfirm) onConfirm(value);
                this.close(modal);
                resolve(value);
            });

            cancelBtn.addEventListener('click', () => {
                if (onCancel) onCancel();
                this.close(modal);
                resolve(null);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            });

            this.open(modal);
        });
    },

    /**
     * 设置标题
     */
    setTitle(selector, title) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const header = modal.querySelector('.candy-modal-header');
        if (header) {
            header.textContent = title;
        }
    },

    /**
     * 设置内容
     */
    setContent(selector, content) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const body = modal.querySelector('.candy-modal-body');
        if (body) {
            body.innerHTML = content;
        }
    },

    /**
     * 设置底部
     */
    setFooter(selector, footer) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        let footerEl = modal.querySelector('.candy-modal-footer');
        if (!footerEl) {
            footerEl = document.createElement('div');
            footerEl.className = 'candy-modal-footer';
            modal.appendChild(footerEl);
        }
        footerEl.innerHTML = footer;
    },

    /**
     * 设置大小
     */
    setSize(selector, size) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const sizes = {
            sm: '400px',
            md: '500px',
            lg: '700px',
            xl: '900px'
        };

        modal.style.maxWidth = sizes[size] || sizes.md;
    },

    /**
     * 设置位置
     */
    setPosition(selector, position) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const overlay = modal.closest('.candy-modal-overlay');
        if (!overlay) return;

        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';

        switch (position) {
            case 'top':
                overlay.style.alignItems = 'flex-start';
                modal.style.marginTop = '50px';
                break;
            case 'bottom':
                overlay.style.alignItems = 'flex-end';
                modal.style.marginBottom = '50px';
                break;
            case 'left':
                overlay.style.justifyContent = 'flex-start';
                modal.style.marginLeft = '50px';
                break;
            case 'right':
                overlay.style.justifyContent = 'flex-end';
                modal.style.marginRight = '50px';
                break;
            default:
                modal.style.margin = '';
        }
    },

    /**
     * 启用3D翻转效果
     */
    enable3D(selector) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        modal.style.transform = 'perspective(1000px) rotateX(15deg) scale(0.9)';
        modal.style.opacity = '0';
        
        requestAnimationFrame(() => {
            modal.classList.add('active');
            modal.style.transform = 'perspective(1000px) rotateX(0deg) scale(1)';
            modal.style.opacity = '1';
            modal.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
    },

    /**
     * 启用发光效果
     */
    enableGlow(selector, color = '#667eea') {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        modal.style.boxShadow = `
            0 0 30px ${color},
            0 0 60px ${color}80,
            0 0 90px ${color}40
        `;
    },

    /**
     * 设置动画类型
     */
    setAnimation(selector, animation) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const animations = {
            fade: { transform: 'scale(0.9)', opacity: '0' },
            slideUp: { transform: 'translateY(50px)', opacity: '0' },
            slideDown: { transform: 'translateY(-50px)', opacity: '0' },
            slideLeft: { transform: 'translateX(50px)', opacity: '0' },
            slideRight: { transform: 'translateX(-50px)', opacity: '0' },
            bounce: { transform: 'scale(0)', opacity: '0' },
            flip: { transform: 'perspective(1000px) rotateY(90deg)', opacity: '0' },
            rotate: { transform: 'perspective(1000px) rotateX(90deg)', opacity: '0' }
        };

        if (animations[animation]) {
            modal.style.transform = animations[animation].transform;
            modal.style.opacity = animations[animation].opacity;
        }
    },

    /**
     * 打开时回调
     */
    onOpen(selector, callback) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        modal.addEventListener('candy-modal-open', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 关闭时回调
     */
    onClose(selector, callback) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        modal.addEventListener('candy-modal-close', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 确认时回调
     */
    onConfirm(callback) {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="confirm"]')) {
                callback();
            }
        });
    },

    /**
     * 取消时回调
     */
    onCancel(callback) {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="cancel"]')) {
                callback();
            }
        });
    },

    /**
     * 关闭所有模态框
     */
    closeAll() {
        this.activeStack.forEach(modal => {
            this.close(modal);
        });
        this.activeStack = [];
    },

    /**
     * 获取当前打开的模态框
     */
    getActive() {
        return this.activeStack[this.activeStack.length - 1] || null;
    },

    /**
     * 设置堆叠顺序
     */
    stackOrder(selector, zIndex = 9999) {
        const modal = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        
        if (!modal) return;

        const overlay = modal.closest('.candy-modal-overlay');
        if (overlay) {
            overlay.style.zIndex = zIndex;
        }
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化所有带有 data-modal 属性的按钮
    document.querySelectorAll('[data-modal]').forEach(trigger => {
        const modalId = trigger.getAttribute('data-modal');
        const modal = document.getElementById(modalId);
        
        if (modal) {
            trigger.addEventListener('click', () => {
                CandyModal.open(modal);
            });
        }
    });
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyModal;
}