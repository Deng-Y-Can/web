/**
 * CandyUI - 折叠面板组件
 * 功能完整的可折叠面板组件，支持3D效果和多种动画
 */

const CandyAccordion = {
    // 存储所有折叠面板实例
    instances: new Map(),
    // 计数器
    counter: 0,

    /**
     * 初始化所有折叠面板
     */
    init() {
        document.querySelectorAll('.candy-accordion').forEach(accordion => {
            this.initInstance(accordion);
        });
    },

    /**
     * 初始化实例
     */
    initInstance(accordion) {
        const id = `accordion-${++this.counter}`;
        accordion.dataset.accordionId = id;
        
        const items = accordion.querySelectorAll('.candy-accordion-item');
        const headers = accordion.querySelectorAll('.candy-accordion-header');
        
        // 绑定点击事件
        headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                this.toggle(accordion, index);
            });
        });
        
        // 创建实例
        const instance = {
            id: id,
            element: accordion,
            items: items,
            headers: headers,
            activeIndex: -1,
            config: {
                animation: 'slide',
                multiOpen: false,
                speed: 300
            }
        };
        
        this.instances.set(id, instance);
        
        return instance;
    },

    /**
     * 切换面板
     */
    toggle(accordionElement, index) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items, config } = instance;
        const item = items[index];
        
        if (item.classList.contains('active')) {
            this.close(accordionElement, index);
        } else {
            // 如果不是多开，先关闭其他
            if (!config.multiOpen) {
                this.closeAll(accordionElement);
            }
            this.open(accordionElement, index);
        }
    },

    /**
     * 展开面板
     */
    open(accordionElement, index) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items, headers } = instance;
        const item = items[index];
        const header = headers[index];
        
        if (!item || item.classList.contains('active')) return;
        
        // 添加激活状态
        item.classList.add('active');
        instance.activeIndex = index;
        
        // 触发动画
        const content = item.querySelector('.candy-accordion-content');
        if (content) {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
        
        // 触发事件
        accordionElement.dispatchEvent(new CustomEvent('candy-accordion-open', {
            bubbles: true,
            detail: { index, item, header }
        }));
    },

    /**
     * 收起面板
     */
    close(accordionElement, index) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items, headers } = instance;
        const item = items[index];
        const header = headers[index];
        
        if (!item || !item.classList.contains('active')) return;
        
        // 移除激活状态
        item.classList.remove('active');
        
        // 触发动画
        const content = item.querySelector('.candy-accordion-content');
        if (content) {
            content.style.maxHeight = '0';
        }
        
        // 触发事件
        accordionElement.dispatchEvent(new CustomEvent('candy-accordion-close', {
            bubbles: true,
            detail: { index, item, header }
        }));
    },

    /**
     * 关闭所有面板
     */
    closeAll(accordionElement) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items } = instance;
        
        items.forEach((item, index) => {
            if (item.classList.contains('active')) {
                this.close(accordionElement, index);
            }
        });
        
        instance.activeIndex = -1;
    },

    /**
     * 展开所有面板
     */
    openAll(accordionElement) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items } = instance;
        
        items.forEach((item, index) => {
            if (!item.classList.contains('active')) {
                this.open(accordionElement, index);
            }
        });
    },

    /**
     * 创建折叠面板
     */
    create(options = {}) {
        const {
            id = `accordion-${Date.now()}`,
            style = 'accordion-1',
            animation = 'slide',
            multiOpen = false,
            panels = [],
            onPanelOpen,
            onPanelClose,
            onPanelClick
        } = options;
        
        const accordionElement = document.createElement('div');
        accordionElement.className = `candy-accordion ${style}`;
        accordionElement.id = id;
        
        // 添加面板
        panels.forEach((panel, index) => {
            const item = this.createPanel(panel.title, panel.content, index);
            accordionElement.appendChild(item);
        });
        
        // 初始化
        const instance = this.initInstance(accordionElement);
        instance.config.animation = animation;
        instance.config.multiOpen = multiOpen;
        
        // 绑定回调
        if (onPanelOpen) {
            accordionElement.addEventListener('candy-accordion-open', (e) => {
                onPanelOpen(e.detail);
            });
        }
        if (onPanelClose) {
            accordionElement.addEventListener('candy-accordion-close', (e) => {
                onPanelClose(e.detail);
            });
        }
        if (onPanelClick) {
            accordionElement.addEventListener('click', (e) => {
                const header = e.target.closest('.candy-accordion-header');
                if (header) {
                    const index = Array.from(instance.headers).indexOf(header);
                    onPanelClick({ index, header });
                }
            });
        }
        
        return accordionElement;
    },

    /**
     * 创建面板
     */
    createPanel(title, content, index = 0) {
        const item = document.createElement('div');
        item.className = 'candy-accordion-item';
        
        item.innerHTML = `
            <button class="candy-accordion-header">
                <span>${title}</span>
                <span class="candy-accordion-arrow"></span>
            </button>
            <div class="candy-accordion-content">
                <div class="candy-accordion-body">${content}</div>
            </div>
        `;
        
        return item;
    },

    /**
     * 添加面板
     */
    addPanel(accordionElement, options = {}) {
        const {
            title = '新面板',
            content = '',
            index = -1
        } = options;
        
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const panel = this.createPanel(title, content, instance.items.length);
        
        if (index >= 0 && index < accordionElement.children.length) {
            accordionElement.insertBefore(panel, accordionElement.children[index]);
        } else {
            accordionElement.appendChild(panel);
        }
        
        // 重新初始化
        const newInstance = this.initInstance(accordionElement);
        
        // 绑定点击事件
        const newHeader = panel.querySelector('.candy-accordion-header');
        const newIndex = Array.from(newInstance.headers).indexOf(newHeader);
        newHeader.addEventListener('click', () => {
            this.toggle(accordionElement, newIndex);
        });
        
        return panel;
    },

    /**
     * 移除面板
     */
    removePanel(accordionElement, index) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items } = instance;
        
        if (items[index]) {
            items[index].remove();
            // 重新初始化
            this.initInstance(accordionElement);
        }
    },

    /**
     * 更新面板
     */
    updatePanel(accordionElement, index, options = {}) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { items, headers } = instance;
        
        if (items[index]) {
            if (options.title) {
                const titleSpan = headers[index].querySelector('span:first-child');
                if (titleSpan) {
                    titleSpan.textContent = options.title;
                }
            }
            if (options.content) {
                const body = items[index].querySelector('.candy-accordion-body');
                if (body) {
                    body.innerHTML = options.content;
                }
            }
        }
    },

    /**
     * 设置激活面板
     */
    setActive(accordionElement, index) {
        this.open(accordionElement, index);
    },

    /**
     * 获取当前激活面板
     */
    getActive(accordionElement) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return null;
        
        const { activeIndex, items, headers } = instance;
        
        if (activeIndex >= 0 && items[activeIndex]) {
            return {
                index: activeIndex,
                item: items[activeIndex],
                header: headers[activeIndex]
            };
        }
        
        return null;
    },

    /**
     * 启用多开
     */
    enableMultiOpen(accordionElement) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        instance.config.multiOpen = true;
    },

    /**
     * 禁用多开
     */
    disableMultiOpen(accordionElement) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        instance.config.multiOpen = false;
    },

    /**
     * 设置动画
     */
    setAnimation(accordionElement, animation) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        instance.config.animation = animation;
    },

    /**
     * 设置速度
     */
    setSpeed(accordionElement, speed) {
        const id = accordionElement.dataset.accordionId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        instance.config.speed = speed;
    },

    /**
     * 启用3D效果
     */
    enable3D(accordionElement) {
        const instance = this.instances.get(accordionElement.dataset.accordionId);
        if (!instance) return;
        
        accordionElement.classList.add('accordion-5');
    },

    /**
     * 设置发光
     */
    setGlow(accordionElement, color = '#667eea') {
        const instance = this.instances.get(accordionElement.dataset.accordionId);
        if (!instance) return;
        
        accordionElement.style.setProperty('--accordion-glow', color);
    },

    /**
     * 设置旋转角度
     */
    setRotate(accordionElement, degree = 0) {
        const instance = this.instances.get(accordionElement.dataset.accordionId);
        if (!instance) return;
        
        const { items } = instance;
        items.forEach(item => {
            item.style.transform = `rotate(${degree}deg)`;
        });
    },

    /**
     * 面板变化时回调
     */
    onPanelChange(accordionElement, callback) {
        accordionElement.addEventListener('candy-accordion-open', (e) => {
            callback(e.detail);
        });
        accordionElement.addEventListener('candy-accordion-close', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 展开时回调
     */
    onPanelOpen(accordionElement, callback) {
        accordionElement.addEventListener('candy-accordion-open', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 收起时回调
     */
    onPanelClose(accordionElement, callback) {
        accordionElement.addEventListener('candy-accordion-close', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 点击时回调
     */
    onPanelClick(accordionElement, callback) {
        const instance = this.instances.get(accordionElement.dataset.accordionId);
        if (!instance) return;
        
        instance.headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                callback({ index, header });
            });
        });
    },

    /**
     * 获取面板数量
     */
    getPanelCount(accordionElement) {
        const instance = this.instances.get(accordionElement.dataset.accordionId);
        if (!instance) return 0;
        
        return instance.items.length;
    },

    /**
     * 获取面板内容
     */
    getPanelContent(accordionElement, index) {
        const instance = this.instances.get(accordionElement.dataset.accordionId);
        if (!instance) return null;
        
        const { items } = instance;
        
        if (items[index]) {
            const body = items[index].querySelector('.candy-accordion-body');
            return body?.innerHTML || null;
        }
        
        return null;
    },

    /**
     * 更新内容
     */
    updateContent(accordionElement, index, content) {
        this.updatePanel(accordionElement, index, { content });
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyAccordion.init();
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyAccordion;
}