/**
 * CandyBreadcrumb - 增强版面包屑导航组件
 * @description 提供完整的导航功能、路径追踪、动画效果、动态管理和事件回调支持
 * @version 2.0.0
 */

const CandyBreadcrumb = {
    // ==================== 私有属性 ====================
    _instances: new Map(),      // 实例存储
    _history: [],                // 全局导航历史
    _historyIndex: -1,           // 历史记录指针
    _callbacks: {                // 事件回调存储
        navigate: [],
        itemClick: [],
        pathChange: []
    },
    _defaultOptions: {           // 默认配置
        enableTransitions: false,
        transitionDuration: 300,
        transitionType: 'slide', // slide | fade | scale
        separator: '/',
        separatorType: 'text',   // text | icon | symbol
        enableHistory: true,
        animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    },

    // ==================== 初始化 ====================
    /**
     * 初始化组件
     */
    init() {
        this.bindEvents();
        this._initPopState();
    },

    /**
     * 绑定全局事件
     */
    bindEvents() {
        document.querySelectorAll('.candy-breadcrumb').forEach(breadcrumb => {
            this._bindBreadcrumbEvents(breadcrumb);
        });
    },

    /**
     * 为单个面包屑绑定事件
     * @param {HTMLElement} breadcrumb - 面包屑容器
     */
    _bindBreadcrumbEvents(breadcrumb) {
        const instanceId = this._getInstanceId(breadcrumb);
        
        // 初始化实例数据
        if (!this._instances.has(instanceId)) {
            this._instances.set(instanceId, {
                element: breadcrumb,
                history: [],
                historyIndex: -1,
                currentPath: [],
                activeIndex: -1,
                options: { ...this._defaultOptions }
            });
        }

        // 绑定链接点击事件
        breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const li = link.parentElement;
                const index = Array.from(breadcrumb.querySelectorAll('li')).indexOf(li);
                const item = this._getItemData(link);
                
                // 触发点击回调
                this._triggerCallback('itemClick', { 
                    element: breadcrumb, 
                    index, 
                    item,
                    link 
                });

                // 触发导航
                this._navigate(breadcrumb, index, item);
            });

            // 悬停事件
            link.addEventListener('mouseenter', () => {
                link.dispatchEvent(new CustomEvent('candy-breadcrumb-hover', {
                    detail: { active: true, text: link.textContent },
                    bubbles: true
                }));
            });

            link.addEventListener('mouseleave', () => {
                link.dispatchEvent(new CustomEvent('candy-breadcrumb-hover', {
                    detail: { active: false, text: link.textContent },
                    bubbles: true
                }));
            });
        });
    },

    /**
     * 初始化浏览器后退事件监听
     */
    _initPopState() {
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.candyBreadcrumb) {
                const { instanceId, index } = e.state.candyBreadcrumb;
                this._instances.forEach((instance, id) => {
                    if (id === instanceId) {
                        this._updateActiveFromHistory(instance, index);
                    }
                });
            }
        });
    },

    // ==================== 可点击导航功能 ====================
    /**
     * 启用点击导航功能
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    enableNavigation(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            instance.options.enableHistory = true;
        }

        this._bindBreadcrumbEvents(breadcrumb);
        this._updateBreadcrumbState(breadcrumb);
    },

    /**
     * 执行导航
     * @param {HTMLElement} breadcrumb - 面包屑容器
     * @param {number} index - 目标索引
     * @param {Object} item - 导航项数据
     */
    _navigate(breadcrumb, index, item) {
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (!instance || !instance.options.enableHistory) return;

        // 记录历史
        instance.historyIndex++;
        instance.history = instance.history.slice(0, instance.historyIndex);
        instance.history.push({ index, item, timestamp: Date.now() });
        instance.historyIndex = instance.history.length - 1;

        // 添加到全局历史
        this._history.push({ instanceId, index, item, timestamp: Date.now() });
        this._historyIndex = this._history.length - 1;

        // 更新浏览器历史
        history.pushState(
            { candyBreadcrumb: { instanceId, index } },
            '',
            item.href || '#'
        );

        // 设置激活项
        this._setActiveInternal(breadcrumb, index);

        // 触发导航回调
        this._triggerCallback('navigate', { 
            element: breadcrumb, 
            index, 
            item,
            history: instance.history 
        });
    },

    /**
     * 从历史记录更新激活状态
     * @param {Object} instance - 实例对象
     * @param {number} index - 目标索引
     */
    _updateActiveFromHistory(instance, index) {
        this._setActiveInternal(instance.element, index);
    },

    // ==================== 路径追踪功能 ====================
    /**
     * 设置完整路径
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Array} items - 路径项数组
     */
    setPath(selector, items) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb || !Array.isArray(items)) return;

        // 清空现有内容
        breadcrumb.innerHTML = '';

        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        const separator = instance?.options.separator || '/';
        const separatorType = instance?.options.separatorType || 'text';

        items.forEach((item, index) => {
            // 创建列表项
            const li = document.createElement('li');
            
            if (index < items.length - 1) {
                // 可点击链接
                const a = document.createElement('a');
                a.href = item.href || '#';
                a.textContent = item.text || `导航项${index + 1}`;
                a.setAttribute('data-index', index);
                a.setAttribute('data-text', item.text || `导航项${index + 1}`);
                li.appendChild(a);
            } else {
                // 当前激活项
                const span = document.createElement('span');
                span.textContent = item.text || `当前位置${index + 1}`;
                span.setAttribute('data-index', index);
                span.className = 'candy-breadcrumb-active';
                li.appendChild(span);
            }

            breadcrumb.appendChild(li);

            // 添加分隔符
            if (index < items.length - 1) {
                const sep = this._createSeparator(separator, separatorType);
                breadcrumb.appendChild(sep);
            }
        });

        // 更新实例数据
        if (instance) {
            instance.currentPath = [...items];
            instance.activeIndex = items.length - 1;
        }

        // 重新绑定事件
        this._bindBreadcrumbEvents(breadcrumb);

        // 触发路径变化回调
        this._triggerCallback('pathChange', { 
            element: breadcrumb, 
            path: items,
            depth: items.length 
        });
    },

    /**
     * 获取当前路径
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {Array} 路径数组
     */
    getCurrentPath(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return [];

        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        
        if (instance && instance.currentPath.length > 0) {
            return [...instance.currentPath];
        }

        // 从DOM获取
        return this.getItems(breadcrumb);
    },

    /**
     * 获取路径深度
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {number} 路径深度
     */
    getPathDepth(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return 0;

        return breadcrumb.querySelectorAll('li').length;
    },

    /**
     * 比较两条路径是否相等
     * @param {Array} path1 - 路径1
     * @param {Array} path2 - 路径2
     * @returns {boolean} 是否相等
     */
    isPathEqual(path1, path2) {
        if (!Array.isArray(path1) || !Array.isArray(path2)) return false;
        if (path1.length !== path2.length) return false;

        return path1.every((item, index) => {
            const p1 = typeof item === 'object' ? item.text || item.href : item;
            const p2 = typeof path2[index] === 'object' ? path2[index].text || path2[index].href : path2[index];
            return p1 === p2;
        });
    },

    // ==================== 动画效果增强 ====================
    /**
     * 启用过渡动画
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Object} options - 动画选项
     */
    enableTransitions(selector, options = {}) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            instance.options.enableTransitions = true;
            instance.options.transitionDuration = options.duration || 300;
            instance.options.transitionType = options.type || 'slide';
            instance.options.animationEasing = options.easing || 'cubic-bezier(0.4, 0, 0.2, 1)';
        }

        breadcrumb.classList.add('candy-breadcrumb-animated');
    },

    /**
     * 动画导航到指定项
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {number} index - 目标索引
     * @param {Object} options - 动画选项
     */
    animateTo(selector, index, options = {}) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const instance = this._instances.get(this._getInstanceId(breadcrumb));
        if (!instance) return;

        const duration = options.duration || instance.options.transitionDuration || 300;
        const type = options.type || instance.options.transitionType || 'slide';

        const items = breadcrumb.querySelectorAll('li');
        if (!items[index]) return;

        // 获取当前和目标元素
        const currentActive = breadcrumb.querySelector('.candy-breadcrumb-active');
        const targetItem = items[index];

        // 应用动画类
        breadcrumb.classList.add(`candy-breadcrumb-animate-${type}`);

        // 执行动画
        this._performAnimation(breadcrumb, currentActive, targetItem, {
            duration,
            type,
            easing: instance.options.animationEasing,
            callback: () => {
                // 动画完成后设置激活状态
                this._setActiveInternal(breadcrumb, index);
                breadcrumb.classList.remove(`candy-breadcrumb-animate-${type}`);
                
                if (options.callback) options.callback();
            }
        });
    },

    /**
     * 执行动画
     * @param {HTMLElement} breadcrumb - 面包屑容器
     * @param {HTMLElement} from - 起始元素
     * @param {HTMLElement} to - 目标元素
     * @param {Object} options - 动画选项
     */
    _performAnimation(breadcrumb, from, to, options) {
        const { duration, type, easing, callback } = options;

        if (type === 'fade') {
            // 淡入淡出动画
            if (from) {
                from.style.opacity = '0';
                from.style.transform = 'translateY(-10px)';
            }
            if (to) {
                to.style.opacity = '1';
                to.style.transform = 'translateY(0)';
            }
        } else if (type === 'scale') {
            // 缩放动画
            if (from) {
                from.style.transform = 'scale(0.8)';
                from.style.opacity = '0';
            }
            if (to) {
                to.style.transform = 'scale(1)';
                to.style.opacity = '1';
            }
        } else {
            // 滑动动画（默认）
            if (from) {
                from.style.transform = 'translateX(-20px)';
                from.style.opacity = '0';
            }
            if (to) {
                to.style.transform = 'translateX(0)';
                to.style.opacity = '1';
            }
        }

        // 添加过渡样式
        const transitionStyle = `all ${duration}ms ${easing}`;
        breadcrumb.querySelectorAll('li').forEach(li => {
            li.style.transition = transitionStyle;
        });

        // 动画完成后回调
        setTimeout(() => {
            breadcrumb.querySelectorAll('li').forEach(li => {
                li.style.transition = '';
                li.style.transform = '';
                li.style.opacity = '';
            });
            if (callback) callback();
        }, duration);
    },

    // ==================== 动态管理 ====================
    /**
     * 添加导航项
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {Object} item - 导航项数据 {text, href, ...}
     * @param {string|number} position - 位置 'first' | 'last' | number
     */
    addItem(selector, item, position = 'last') {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const li = document.createElement('li');
        
        if (item.href) {
            const a = document.createElement('a');
            a.href = item.href || '#';
            a.textContent = item.text || '导航项';
            a.setAttribute('data-text', item.text || '导航项');
            
            if (item.onClick) {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    item.onClick(e, item);
                });
            }
            
            li.appendChild(a);
        } else {
            const span = document.createElement('span');
            span.textContent = item.text || '导航项';
            li.appendChild(span);
        }

        // 获取分隔符
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        const separator = instance?.options.separator || '/';
        const separatorType = instance?.options.separatorType || 'text';

        // 获取所有li元素
        const items = breadcrumb.querySelectorAll('li');
        
        if (position === 'last') {
            // 添加到末尾前先添加分隔符
            const sep = this._createSeparator(separator, separatorType);
            breadcrumb.appendChild(sep);
            breadcrumb.appendChild(li);
        } else if (position === 'first') {
            // 添加到开头
            const firstLi = items[0];
            if (firstLi) {
                const sep = this._createSeparator(separator, separatorType);
                breadcrumb.insertBefore(li, firstLi);
                breadcrumb.insertBefore(sep, firstLi);
            } else {
                breadcrumb.appendChild(li);
            }
        } else if (typeof position === 'number' && items[position]) {
            // 插入到指定位置
            const sep = this._createSeparator(separator, separatorType);
            breadcrumb.insertBefore(sep, items[position]);
            breadcrumb.insertBefore(li, items[position]);
        }

        // 更新实例数据
        if (instance) {
            const newItem = { text: item.text || '导航项', href: item.href || '#' };
            if (position === 'first') {
                instance.currentPath.unshift(newItem);
            } else if (typeof position === 'number') {
                instance.currentPath.splice(position, 0, newItem);
            } else {
                instance.currentPath.push(newItem);
            }
        }

        this._bindBreadcrumbEvents(breadcrumb);
        this._updateBreadcrumbState(breadcrumb);

        // 触发路径变化
        this._triggerCallback('pathChange', { 
            element: breadcrumb, 
            path: instance?.currentPath || [],
            action: 'add',
            position 
        });
    },

    /**
     * 删除导航项
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {string|number} index - 索引 'first' | 'last' | number
     */
    removeItem(selector, index) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const items = breadcrumb.querySelectorAll('li');
        const separators = breadcrumb.querySelectorAll('.candy-breadcrumb-separator');

        if (items.length === 0) return;

        let removeIndex;
        if (index === 'last') {
            removeIndex = items.length - 1;
        } else if (index === 'first') {
            removeIndex = 0;
        } else if (typeof index === 'number' && items[index]) {
            removeIndex = index;
        } else {
            return;
        }

        // 获取对应的分隔符
        const li = items[removeIndex];
        const prevSep = li.previousElementSibling;
        const nextSep = li.nextElementSibling;

        // 移除分隔符
        if (prevSep && prevSep.classList && prevSep.classList.contains('candy-breadcrumb-separator')) {
            prevSep.remove();
        }
        if (nextSep && nextSep.classList && nextSep.classList.contains('candy-breadcrumb-separator')) {
            nextSep.remove();
        }

        // 移除列表项
        li.remove();

        // 更新实例数据
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            if (removeIndex === 0) {
                instance.currentPath.shift();
            } else if (removeIndex === instance.currentPath.length - 1) {
                instance.currentPath.pop();
            } else {
                instance.currentPath.splice(removeIndex, 1);
            }
        }

        // 触发路径变化
        this._triggerCallback('pathChange', { 
            element: breadcrumb, 
            path: instance?.currentPath || [],
            action: 'remove',
            removedIndex: removeIndex 
        });
    },

    /**
     * 更新导航项
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {number} index - 索引
     * @param {Object} item - 更新的数据 {text, href, ...}
     */
    updateItem(selector, index, item) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const items = breadcrumb.querySelectorAll('li');
        if (!items[index]) return;

        const li = items[index];
        const oldItem = this._getItemData(li.querySelector('a') || li.querySelector('span'));

        // 更新链接
        const a = li.querySelector('a');
        const span = li.querySelector('span');

        if (item.href !== undefined) {
            if (a) {
                a.href = item.href || '#';
            } else if (span) {
                // 将span转换为a
                const newA = document.createElement('a');
                newA.href = item.href || '#';
                newA.textContent = item.text || span.textContent;
                newA.setAttribute('data-text', item.text || span.textContent);
                li.replaceChild(newA, span);
            }
        }

        if (item.text !== undefined) {
            const target = li.querySelector('a') || li.querySelector('span');
            if (target) {
                target.textContent = item.text;
                target.setAttribute('data-text', item.text);
            }
        }

        // 更新实例数据
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance && instance.currentPath[index]) {
            instance.currentPath[index] = { 
                ...instance.currentPath[index], 
                ...item 
            };
        }

        // 触发路径变化
        this._triggerCallback('pathChange', { 
            element: breadcrumb, 
            path: instance?.currentPath || [],
            action: 'update',
            index,
            oldItem,
            newItem: item
        });
    },

    /**
     * 清空路径
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    clearPath(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        breadcrumb.innerHTML = '';

        // 重置实例数据
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            instance.currentPath = [];
            instance.activeIndex = -1;
            instance.history = [];
            instance.historyIndex = -1;
        }

        // 触发路径变化
        this._triggerCallback('pathChange', { 
            element: breadcrumb, 
            path: [],
            action: 'clear'
        });
    },

    // ==================== 分隔符自定义 ====================
    /**
     * 设置分隔符
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {string|Object} separator - 分隔符内容或配置
     */
    setSeparator(selector, separator) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const config = typeof separator === 'string' 
            ? { content: separator, type: 'text' }
            : separator;

        // 更新实例配置
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            instance.options.separator = config.content;
            instance.options.separatorType = config.type || 'text';
        }

        // 移除旧分隔符
        breadcrumb.querySelectorAll('.candy-breadcrumb-separator').forEach(sep => sep.remove());

        // 添加新分隔符
        const items = breadcrumb.querySelectorAll('li');
        items.forEach((li, index) => {
            if (index < items.length - 1) {
                const sep = this._createSeparator(config.content, config.type);
                li.parentNode.insertBefore(sep, li.nextSibling);
            }
        });

        // 应用自定义样式
        if (config.style) {
            const separators = breadcrumb.querySelectorAll('.candy-breadcrumb-separator');
            separators.forEach(sep => {
                Object.assign(sep.style, config.style);
            });
        }
    },

    /**
     * 创建分隔符元素
     * @param {string} content - 分隔符内容
     * @param {string} type - 类型 'text' | 'icon' | 'symbol'
     * @returns {HTMLElement} 分隔符元素
     */
    _createSeparator(content, type = 'text') {
        const sep = document.createElement('span');
        sep.className = 'candy-breadcrumb-separator';
        
        if (type === 'icon') {
            sep.innerHTML = content;
            sep.classList.add('candy-breadcrumb-separator-icon');
        } else if (type === 'symbol') {
            sep.textContent = content;
            sep.classList.add('candy-breadcrumb-separator-symbol');
        } else {
            sep.textContent = content;
        }

        return sep;
    },

    // ==================== 状态管理 ====================
    /**
     * 设置激活项
     * @param {string|HTMLElement} selector - 选择器或元素
     * @param {number} index - 索引
     */
    setActive(selector, index) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        this._setActiveInternal(breadcrumb, index);
    },

    /**
     * 内部设置激活状态方法
     * @param {HTMLElement} breadcrumb - 面包屑容器
     * @param {number} index - 索引
     */
    _setActiveInternal(breadcrumb, index) {
        const items = breadcrumb.querySelectorAll('li');
        if (!items[index]) return;

        // 移除所有激活状态
        items.forEach((li, i) => {
            const span = li.querySelector('span');
            const a = li.querySelector('a');

            if (i === index) {
                // 设置为激活状态
                if (a) {
                    const newSpan = document.createElement('span');
                    newSpan.textContent = a.textContent;
                    newSpan.className = 'candy-breadcrumb-active';
                    newSpan.setAttribute('data-index', i);
                    newSpan.setAttribute('data-text', a.textContent);
                    li.replaceChild(newSpan, a);
                } else if (span) {
                    span.classList.add('candy-breadcrumb-active');
                }
            } else {
                // 非激活项确保是链接
                if (span && span.classList.contains('candy-breadcrumb-active')) {
                    span.classList.remove('candy-breadcrumb-active');
                }
            }
        });

        // 更新实例数据
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            instance.activeIndex = index;
        }
    },

    /**
     * 获取激活项索引
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {number} 激活项索引
     */
    getActiveIndex(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return -1;

        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (instance) {
            return instance.activeIndex;
        }

        // 从DOM获取
        const activeSpan = breadcrumb.querySelector('.candy-breadcrumb-active');
        if (activeSpan) {
            const index = activeSpan.getAttribute('data-index');
            return index !== null ? parseInt(index, 10) : -1;
        }

        return -1;
    },

    /**
     * 获取激活项内容
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {Object|null} 激活项数据
     */
    getActiveItem(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return null;

        const activeIndex = this.getActiveIndex(breadcrumb);
        if (activeIndex < 0) return null;

        const items = this.getItems(breadcrumb);
        return items[activeIndex] || null;
    },

    // ==================== 快捷功能 ====================
    /**
     * 返回上一级
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    goBack(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        if (!instance) return;

        if (instance.historyIndex > 0) {
            instance.historyIndex--;
            const historyItem = instance.history[instance.historyIndex];
            if (historyItem) {
                this.animateTo(breadcrumb, historyItem.index);
            }
        } else {
            // 没有历史记录，返回上一层
            const currentIndex = this.getActiveIndex(breadcrumb);
            if (currentIndex > 0) {
                this.animateTo(breadcrumb, currentIndex - 1);
            }
        }
    },

    /**
     * 返回首页
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    goHome(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        const firstLink = breadcrumb.querySelector('a');
        if (firstLink) {
            const index = parseInt(firstLink.getAttribute('data-index') || '0', 10);
            this.animateTo(breadcrumb, index || 0);
        }
    },

    /**
     * 刷新当前路径
     * @param {string|HTMLElement} selector - 选择器或元素
     */
    refreshPath(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return;

        // 重新绑定事件
        this._bindBreadcrumbEvents(breadcrumb);
        this._updateBreadcrumbState(breadcrumb);

        // 触发路径变化回调
        const instanceId = this._getInstanceId(breadcrumb);
        const instance = this._instances.get(instanceId);
        this._triggerCallback('pathChange', { 
            element: breadcrumb, 
            path: instance?.currentPath || [],
            action: 'refresh'
        });
    },

    // ==================== 事件回调 ====================
    /**
     * 导航时回调
     * @param {Function} callback - 回调函数
     */
    onNavigate(callback) {
        if (typeof callback === 'function') {
            this._callbacks.navigate.push(callback);
        }
    },

    /**
     * 点击项时回调
     * @param {Function} callback - 回调函数
     */
    onItemClick(callback) {
        if (typeof callback === 'function') {
            this._callbacks.itemClick.push(callback);
        }
    },

    /**
     * 路径变化时回调
     * @param {Function} callback - 回调函数
     */
    onPathChange(callback) {
        if (typeof callback === 'function') {
            this._callbacks.pathChange.push(callback);
        }
    },

    /**
     * 触发回调
     * @param {string} type - 回调类型
     * @param {Object} data - 回调数据
     */
    _triggerCallback(type, data) {
        const callbacks = this._callbacks[type] || [];
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`CandyBreadcrumb callback error [${type}]:`, e);
            }
        });
    },

    // ==================== 工具方法 ====================
    /**
     * 创建面包屑导航
     * @param {Object} options - 配置选项
     * @returns {HTMLElement} 创建的面包屑元素
     */
    create(options = {}) {
        const ul = document.createElement('ul');
        ul.className = `candy-breadcrumb candy-breadcrumb-${options.style || 1}`;

        if (options.separator) {
            this.setSeparator(ul, options.separator);
        }

        if (options.enableTransitions !== false) {
            this.enableTransitions(ul, options.transitionOptions || {});
        }

        if (options.items && Array.isArray(options.items)) {
            const separator = options.separator?.content || '/';
            const separatorType = options.separator?.type || 'text';

            options.items.forEach((item, index) => {
                const li = document.createElement('li');

                if (item.href && index < options.items.length - 1) {
                    const a = document.createElement('a');
                    a.href = item.href || '#';
                    a.textContent = item.text || `导航项${index + 1}`;
                    a.setAttribute('data-index', index);
                    a.setAttribute('data-text', item.text || `导航项${index + 1}`);

                    if (item.onClick) {
                        a.addEventListener('click', (e) => {
                            e.preventDefault();
                            item.onClick(e, item);
                        });
                    }

                    li.appendChild(a);
                } else {
                    const span = document.createElement('span');
                    span.textContent = item.text || `当前位置${index + 1}`;
                    span.setAttribute('data-index', index);
                    span.className = 'candy-breadcrumb-active';
                    li.appendChild(span);
                }

                ul.appendChild(li);

                // 添加分隔符
                if (index < options.items.length - 1) {
                    const sep = this._createSeparator(separator, separatorType);
                    ul.appendChild(sep);
                }
            });
        }

        if (options.parent) {
            document.querySelector(options.parent).appendChild(ul);
        }

        // 初始化实例
        const instanceId = this._getInstanceId(ul);
        this._instances.set(instanceId, {
            element: ul,
            history: [],
            historyIndex: -1,
            currentPath: options.items ? [...options.items] : [],
            activeIndex: options.items ? options.items.length - 1 : -1,
            options: { ...this._defaultOptions }
        });

        this._bindBreadcrumbEvents(ul);

        return ul;
    },

    /**
     * 获取所有项
     * @param {string|HTMLElement} selector - 选择器或元素
     * @returns {Array} 项数组
     */
    getItems(selector) {
        const breadcrumb = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!breadcrumb) return [];

        const items = [];
        breadcrumb.querySelectorAll('li').forEach(li => {
            const a = li.querySelector('a');
            const span = li.querySelector('span');

            if (a) {
                items.push({
                    text: a.textContent,
                    href: a.getAttribute('href'),
                    index: parseInt(a.getAttribute('data-index') || '0', 10)
                });
            } else if (span) {
                items.push({
                    text: span.textContent,
                    active: true,
                    index: parseInt(span.getAttribute('data-index') || '0', 10)
                });
            }
        });

        return items;
    },

    /**
     * 获取元素实例ID
     * @param {HTMLElement} element - 元素
     * @returns {string} 实例ID
     */
    _getInstanceId(element) {
        if (!element) return '';
        if (!element._candyBreadcrumbId) {
            element._candyBreadcrumbId = `bw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return element._candyBreadcrumbId;
    },

    /**
     * 更新面包屑状态
     * @param {HTMLElement} breadcrumb - 面包屑容器
     */
    _updateBreadcrumbState(breadcrumb) {
        if (!breadcrumb) return;
        breadcrumb.classList.add('candy-breadcrumb-initialized');
    },

    /**
     * 获取项数据
     * @param {HTMLElement} element - 元素
     * @returns {Object} 项数据
     */
    _getItemData(element) {
        if (!element) return {};
        return {
            text: element.textContent,
            href: element.getAttribute('href'),
            index: parseInt(element.getAttribute('data-index') || '-1', 10)
        };
    }
};

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    CandyBreadcrumb.init();
});

// 导出模块（支持模块化环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CandyBreadcrumb;
}
