/**
 * CandyUI - 标签页组件
 * 功能完整的标签页切换组件，支持3D效果和多种动画
 */

const CandyTabs = {
    // 存储所有标签页实例
    instances: new Map(),
    // 计数器
    counter: 0,

    /**
     * 初始化标签页
     */
    init() {
        document.querySelectorAll('.candy-tabs').forEach(tabs => {
            this.initInstance(tabs);
        });
    },

    /**
     * 初始化实例
     */
    initInstance(tabs) {
        const id = `tabs-${++this.counter}`;
        tabs.dataset.tabsId = id;
        
        const tabsNav = tabs.querySelector('.candy-tabs-nav');
        const tabsContent = tabs.querySelector('.candy-tabs-content');
        const tabElements = tabsNav.querySelectorAll('.candy-tabs-tab');
        const panelElements = tabsContent.querySelectorAll('.candy-tabs-panel');
        
        // 默认激活第一个
        if (tabElements.length > 0) {
            tabElements[0].classList.add('active');
            if (panelElements.length > 0) {
                panelElements[0].classList.add('active');
            }
        }
        
        // 绑定点击事件
        tabElements.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                this.switch(tabs, index);
            });
        });
        
        // 创建实例
        const instance = {
            id: id,
            element: tabs,
            tabsNav: tabsNav,
            tabsContent: tabsContent,
            tabElements: tabElements,
            panelElements: panelElements,
            activeIndex: 0,
            config: {
                animation: 'fade',
                vertical: false,
                align: 'left'
            }
        };
        
        this.instances.set(id, instance);
        
        return instance;
    },

    /**
     * 切换标签页
     */
    switch(tabsElement, index) {
        const id = tabsElement.dataset.tabsId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { tabElements, panelElements } = instance;
        
        // 移除所有激活状态
        tabElements.forEach(tab => tab.classList.remove('active'));
        panelElements.forEach(panel => panel.classList.remove('active'));
        
        // 激活指定索引
        if (tabElements[index]) {
            tabElements[index].classList.add('active');
        }
        if (panelElements[index]) {
            panelElements[index].classList.add('active');
        }
        
        instance.activeIndex = index;
        
        // 触发事件
        tabsElement.dispatchEvent(new CustomEvent('candy-tabs-change', {
            bubbles: true,
            detail: {
                index: index,
                tab: tabElements[index],
                panel: panelElements[index]
            }
        }));
    },

    /**
     * 打开标签页
     */
    open(tabsElement, index) {
        this.switch(tabsElement, index);
    },

    /**
     * 关闭标签页
     */
    close(tabsElement, index) {
        const id = tabsElement.dataset.tabsId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { tabElements, panelElements } = instance;
        
        // 隐藏标签和面板
        if (tabElements[index]) {
            tabElements[index].style.display = 'none';
        }
        if (panelElements[index]) {
            panelElements[index].style.display = 'none';
        }
        
        // 触发事件
        tabsElement.dispatchEvent(new CustomEvent('candy-tabs-close', {
            bubbles: true,
            detail: { index }
        }));
    },

    /**
     * 创建标签页
     */
    create(options = {}) {
        const {
            id = `tabs-${Date.now()}`,
            style = 'tabs-1',
            vertical = false,
            align = 'left',
            tabs = [],
            onChange
        } = options;
        
        const tabsElement = document.createElement('div');
        tabsElement.className = `candy-tabs ${style}`;
        if (vertical) {
            tabsElement.classList.add('vertical');
        }
        if (align) {
            tabsElement.classList.add(`align-${align}`);
        }
        
        // 创建标签导航
        const tabsNav = document.createElement('div');
        tabsNav.className = 'candy-tabs-nav';
        
        // 创建内容区域
        const tabsContent = document.createElement('div');
        tabsContent.className = 'candy-tabs-content';
        
        // 添加标签和面板
        tabs.forEach((tab, index) => {
            const tabElement = document.createElement('button');
            tabElement.className = 'candy-tabs-tab';
            tabElement.textContent = tab.title || `标签 ${index + 1}`;
            tabElement.dataset.index = index;
            
            const panelElement = document.createElement('div');
            panelElement.className = 'candy-tabs-panel';
            panelElement.innerHTML = tab.content || '';
            
            if (index === 0) {
                tabElement.classList.add('active');
                panelElement.classList.add('active');
            }
            
            tabsNav.appendChild(tabElement);
            tabsContent.appendChild(panelElement);
            
            // 绑定点击事件
            tabElement.addEventListener('click', () => {
                this.switch(tabsElement, index);
            });
        });
        
        tabsElement.appendChild(tabsNav);
        tabsElement.appendChild(tabsContent);
        
        // 初始化
        const instance = this.initInstance(tabsElement);
        
        // 绑定回调
        if (onChange) {
            tabsElement.addEventListener('candy-tabs-change', (e) => {
                onChange(e.detail);
            });
        }
        
        return tabsElement;
    },

    /**
     * 添加标签
     */
    addTab(tabsElement, options = {}) {
        const {
            title = '新标签',
            content = '',
            index = -1
        } = options;
        
        const id = tabsElement.dataset.tabsId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { tabsNav, tabsContent, tabElements, panelElements } = instance;
        
        const tabElement = document.createElement('button');
        tabElement.className = 'candy-tabs-tab';
        tabElement.textContent = title;
        tabElement.dataset.index = tabElements.length;
        
        const panelElement = document.createElement('div');
        panelElement.className = 'candy-tabs-panel';
        panelElement.innerHTML = content;
        
        // 绑定点击事件
        tabElement.addEventListener('click', () => {
            const newIndex = tabElements.length;
            this.switch(tabsElement, newIndex);
        });
        
        // 添加到DOM
        if (index >= 0 && index < tabsNav.children.length) {
            tabsNav.insertBefore(tabElement, tabsNav.children[index]);
            tabsContent.insertBefore(panelElement, tabsContent.children[index]);
        } else {
            tabsNav.appendChild(tabElement);
            tabsContent.appendChild(panelElement);
        }
        
        // 更新实例
        instance.tabElements = tabsNav.querySelectorAll('.candy-tabs-tab');
        instance.panelElements = tabsContent.querySelectorAll('.candy-tabs-panel');
        
        return { tab: tabElement, panel: panelElement };
    },

    /**
     * 移除标签
     */
    removeTab(tabsElement, index) {
        this.close(tabsElement, index);
    },

    /**
     * 更新标签
     */
    updateTab(tabsElement, index, options = {}) {
        const id = tabsElement.dataset.tabsId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { tabElements, panelElements } = instance;
        
        if (tabElements[index]) {
            if (options.title) {
                tabElements[index].textContent = options.title;
            }
            if (options.content) {
                panelElements[index].innerHTML = options.content;
            }
        }
    },

    /**
     * 设置激活标签
     */
    setActive(tabsElement, index) {
        this.switch(tabsElement, index);
    },

    /**
     * 获取当前激活标签
     */
    getActive(tabsElement) {
        const id = tabsElement.dataset.tabsId;
        const instance = this.instances.get(id);
        if (!instance) return null;
        
        const { activeIndex, tabElements, panelElements } = instance;
        return {
            index: activeIndex,
            tab: tabElements[activeIndex],
            panel: panelElements[activeIndex]
        };
    },

    /**
     * 设置位置
     */
    setPosition(tabsElement, position) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { element } = instance;
        
        // 移除旧位置
        element.classList.remove('vertical', 'horizontal');
        
        // 设置新位置
        if (position === 'left' || position === 'right') {
            element.classList.add('vertical');
        }
    },

    /**
     * 设置对齐方式
     */
    setAlignment(tabsElement, align) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { element } = instance;
        
        // 移除旧对齐
        element.classList.remove('align-left', 'align-center', 'align-right');
        
        // 设置新对齐
        element.classList.add(`align-${align}`);
    },

    /**
     * 启用关闭按钮
     */
    enableClose(tabsElement, index) {
        const id = tabsElement.dataset.tabsId;
        const instance = this.instances.get(id);
        if (!instance) return;
        
        const { tabElements } = instance;
        
        if (tabElements[index]) {
            const closeBtn = document.createElement('span');
            closeBtn.className = 'candy-tabs-close';
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                margin-left: 8px;
                cursor: pointer;
                opacity: 0.7;
            `;
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close(tabsElement, index);
            });
            
            tabElements[index].appendChild(closeBtn);
        }
    },

    /**
     * 启用滚动
     */
    enableScroll(tabsElement) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { tabsNav } = instance;
        tabsNav.style.overflowX = 'auto';
        tabsNav.style.whiteSpace = 'nowrap';
    },

    /**
     * 设置动画
     */
    setAnimation(tabsElement, animation) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        instance.config.animation = animation;
    },

    /**
     * 启用3D效果
     */
    enable3D(tabsElement) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { element } = instance;
        element.classList.add('tabs-5');
    },

    /**
     * 设置发光
     */
    setGlow(tabsElement, color = '#667eea') {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { element, tabElements } = instance;
        tabElements.forEach(tab => {
            tab.style.setProperty('--tabs-glow', color);
        });
    },

    /**
     * 设置深度
     */
    setDepth(tabsElement, depth = 50) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { element, tabElements } = instance;
        tabElements.forEach(tab => {
            tab.style.perspective = `${depth}px`;
        });
    },

    /**
     * 切换时回调
     */
    onTabChange(tabsElement, callback) {
        tabsElement.addEventListener('candy-tabs-change', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 打开时回调
     */
    onTabOpen(tabsElement, callback) {
        tabsElement.addEventListener('candy-tabs-change', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 关闭时回调
     */
    onTabClose(tabsElement, callback) {
        tabsElement.addEventListener('candy-tabs-close', (e) => {
            callback(e.detail);
        });
    },

    /**
     * 点击时回调
     */
    onTabClick(tabsElement, callback) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return;
        
        const { tabElements } = instance;
        tabElements.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                callback({ index, tab });
            });
        });
    },

    /**
     * 获取标签数量
     */
    getTabCount(tabsElement) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return 0;
        
        return instance.tabElements.length;
    },

    /**
     * 获取标签内容
     */
    getTabContent(tabsElement, index) {
        const instance = this.instances.get(tabsElement.dataset.tabsId);
        if (!instance) return null;
        
        return instance.panelElements[index]?.innerHTML || null;
    },

    /**
     * 更新内容
     */
    updateContent(tabsElement, index, content) {
        this.updateTab(tabsElement, index, { content });
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyTabs.init();
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyTabs;
}