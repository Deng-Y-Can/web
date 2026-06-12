/**
 * Candy-Label 标签组件
 * 功能：拖拽排序、颜色切换、图标支持、可关闭、可编辑、动态管理、计数功能
 * 
 * 使用方法：
 *   import CandyLabel from './candy-label.js';
 *   
 *   // 创建标签
 *   CandyLabel.create({
 *     text: '标签名称',
 *     color: 'primary',
 *     icon: '★',
 *     closable: true,
 *     count: 5
 *   });
 *   
 *   // 启用拖拽排序
 *   CandyLabel.enableDragSort('.label-container');
 */

const CandyLabel = (function () {
  'use strict';

  // 默认配置
  const defaultConfig = {
    text: '',
    color: 'primary',
    icon: null,
    iconPosition: 'left',
    closable: false,
    count: null,
    editable: false,
    onClick: null,
    onClose: null,
    onEdit: null,
    onChange: null
  };

  // 预设颜色配置（对应CSS变量）
  const colorPresets = {
    primary: {
      bg: 'var(--label-primary-bg, #0d6efd)',
      color: 'var(--label-primary-color, #ffffff)',
      border: 'var(--label-primary-border, #0d6efd)'
    },
    success: {
      bg: 'var(--label-success-bg, #198754)',
      color: 'var(--label-success-color, #ffffff)',
      border: 'var(--label-success-border, #198754)'
    },
    warning: {
      bg: 'var(--label-warning-bg, #ffc107)',
      color: 'var(--label-warning-color, #000000)',
      border: 'var(--label-warning-border, #ffc107)'
    },
    danger: {
      bg: 'var(--label-danger-bg, #dc3545)',
      color: 'var(--label-danger-color, #ffffff)',
      border: 'var(--label-danger-border, #dc3545)'
    },
    info: {
      bg: 'var(--label-info-bg, #0dcaf0)',
      color: 'var(--label-info-color, #000000)',
      border: 'var(--label-info-border, #0dcaf0)'
    },
    dark: {
      bg: 'var(--label-dark-bg, #212529)',
      color: 'var(--label-dark-color, #ffffff)',
      border: 'var(--label-dark-border, #212529)'
    },
    light: {
      bg: 'var(--label-light-bg, #f8f9fa)',
      color: 'var(--label-light-color, #000000)',
      border: 'var(--label-light-border, #f8f9fa)'
    }
  };

  // 拖拽状态
  let dragSortEnabled = false;
  let draggedElement = null;
  let placeholderElement = null;

  /**
   * 创建标签元素
   * @param {Object} options - 配置选项
   * @returns {HTMLElement} 标签元素
   */
  function create(options = {}) {
    const config = { ...defaultConfig, ...options };
    
    // 创建标签容器
    const label = document.createElement('span');
    label.className = 'candy-label';
    label.dataset.color = config.color;
    
    // 设置样式
    applyColor(label, config.color);
    
    // 构建标签内容
    const content = document.createElement('span');
    content.className = 'candy-label-content';
    
    // 前缀图标
    if (config.icon && config.iconPosition === 'left') {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'candy-label-icon candy-label-icon-left';
      iconSpan.textContent = config.icon;
      content.appendChild(iconSpan);
    }
    
    // 标签文字
    const textSpan = document.createElement('span');
    textSpan.className = 'candy-label-text';
    textSpan.textContent = config.text;
    textSpan.dataset.originalText = config.text;
    content.appendChild(textSpan);
    
    // 计数
    if (config.count !== null) {
      const countSpan = document.createElement('span');
      countSpan.className = 'candy-label-count';
      countSpan.textContent = `(${config.count})`;
      content.appendChild(countSpan);
    }
    
    // 后缀图标
    if (config.icon && config.iconPosition === 'right') {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'candy-label-icon candy-label-icon-right';
      iconSpan.textContent = config.icon;
      content.appendChild(iconSpan);
    }
    
    label.appendChild(content);
    
    // 关闭按钮
    if (config.closable) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'candy-label-close';
      closeBtn.innerHTML = '×';
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const closeEvent = new CustomEvent('close', {
          detail: { element: label },
          bubbles: true
        });
        label.dispatchEvent(closeEvent);
        if (typeof config.onClose === 'function') {
          config.onClose(label);
        }
        label.classList.add('candy-label-close-animate');
        setTimeout(() => label.remove(), 300);
      });
      label.appendChild(closeBtn);
      label.dataset.closable = 'true';
    }
    
    // 点击事件
    if (typeof config.onClick === 'function') {
      label.addEventListener('click', function (e) {
        if (e.target.classList.contains('candy-label-close')) return;
        config.onClick(label);
      });
    }
    
    // 双击编辑
    if (config.editable) {
      label.dataset.editable = 'true';
      label.addEventListener('dblclick', function () {
        enableEdit(label);
      });
    }
    
    // 存储配置
    label._candyLabelConfig = config;
    
    return label;
  }

  /**
   * 应用颜色样式
   * @param {HTMLElement} label - 标签元素
   * @param {string} color - 颜色名称
   */
  function applyColor(label, color) {
    const colorConfig = colorPresets[color] || colorPresets.primary;
    label.style.backgroundColor = colorConfig.bg;
    label.style.color = colorConfig.color;
    label.style.borderColor = colorConfig.border;
    label.dataset.color = color;
  }

  /**
   * 设置标签颜色
   * @param {string} selector - 选择器或元素
   * @param {string} color - 颜色名称
   */
  function setColor(selector, color) {
    const elements = typeof selector === 'string' 
      ? document.querySelectorAll(selector) 
      : [selector];
    
    elements.forEach(el => {
      if (el.classList && el.classList.contains('candy-label')) {
        applyColor(el, color);
        // 触发颜色变更事件
        el.dispatchEvent(new CustomEvent('colorChange', {
          detail: { color: color },
          bubbles: true
        }));
      }
    });
  }

  /**
   * 启用拖拽排序
   * @param {string} containerSelector - 容器选择器
   */
  function enableDragSort(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    dragSortEnabled = true;
    container.dataset.dragSort = 'true';
    
    // 初始化拖拽事件
    container.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    // 触摸事件支持
    container.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  }

  /**
   * 禁用拖拽排序
   * @param {string} containerSelector - 容器选择器
   */
  function disableDragSort(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    dragSortEnabled = false;
    delete container.dataset.dragSort;
    
    container.removeEventListener('mousedown', handleDragStart);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    container.removeEventListener('touchstart', handleDragStart);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
  }

  /**
   * 处理拖拽开始
   * @param {Event} e - 事件对象
   */
  function handleDragStart(e) {
    const container = e.currentTarget;
    if (container.dataset.dragSort !== 'true') return;
    
    const target = e.target.closest('.candy-label');
    if (!target || target.querySelector('.candy-label-close')) return;
    
    // 如果点击的是可编辑标签且双击进入编辑状态，不允许拖拽
    const editInput = target.querySelector('.candy-label-edit-input');
    if (editInput) return;
    
    draggedElement = target;
    draggedElement.classList.add('candy-label-dragging');
    
    // 创建占位符
    placeholderElement = document.createElement('span');
    placeholderElement.className = 'candy-label-placeholder';
    placeholderElement.style.width = target.offsetWidth + 'px';
    placeholderElement.style.height = target.offsetHeight + 'px';
    
    // 获取初始位置
    const rect = target.getBoundingClientRect();
    draggedElement.style.width = rect.width + 'px';
    draggedElement.style.position = 'fixed';
    draggedElement.style.left = rect.left + 'px';
    draggedElement.style.top = rect.top + 'px';
    draggedElement.style.zIndex = '9999';
    draggedElement.style.pointerEvents = 'none';
    
    document.body.appendChild(draggedElement);
    
    // 插入占位符
    const nextSibling = target.nextSibling;
    container.insertBefore(placeholderElement, nextSibling);
    
    // 存储初始索引
    draggedElement._startIndex = getElementIndex(container, target);
  }

  /**
   * 处理拖拽移动
   * @param {Event} e - 事件对象
   */
  function handleDragMove(e) {
    if (!draggedElement) return;
    
    e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    draggedElement.style.left = clientX + 'px';
    draggedElement.style.top = clientY + 'px';
    
    // 更新位置
    const container = document.querySelector('[data-drag-sort="true"]');
    if (!container) return;
    
    const labels = Array.from(container.querySelectorAll('.candy-label:not(.candy-label-dragging)'));
    const placeholderRect = placeholderElement.getBoundingClientRect();
    
    let insertBefore = null;
    labels.forEach((label, index) => {
      const rect = label.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      if (clientY < midY) {
        insertBefore = label;
      }
    });
    
    // 移动占位符
    if (insertBefore && insertBefore.nextSibling !== placeholderElement) {
      container.insertBefore(placeholderElement, insertBefore);
    } else if (!insertBefore && placeholderElement.nextSibling !== labels[labels.length - 1]) {
      container.appendChild(placeholderElement);
    }
  }

  /**
   * 处理拖拽结束
   * @param {Event} e - 事件对象
   */
  function handleDragEnd(e) {
    if (!draggedElement) return;
    
    const container = document.querySelector('[data-drag-sort="true"]');
    if (container) {
      // 获取新索引
      const newIndex = getElementIndex(container, placeholderElement);
      const oldIndex = draggedElement._startIndex;
      
      // 插入到新位置
      if (placeholderElement.nextSibling) {
        container.insertBefore(draggedElement, placeholderElement.nextSibling);
      } else {
        container.appendChild(draggedElement);
      }
      
      // 触发排序变更事件
      if (oldIndex !== newIndex) {
        container.dispatchEvent(new CustomEvent('sortChange', {
          detail: {
            element: draggedElement,
            oldIndex: oldIndex,
            newIndex: newIndex
          },
          bubbles: true
        }));
      }
    }
    
    // 清理样式
    draggedElement.classList.remove('candy-label-dragging');
    draggedElement.style.position = '';
    draggedElement.style.left = '';
    draggedElement.style.top = '';
    draggedElement.style.width = '';
    draggedElement.style.zIndex = '';
    draggedElement.style.pointerEvents = '';
    
    // 移除占位符
    if (placeholderElement && placeholderElement.parentNode) {
      placeholderElement.remove();
    }
    
    draggedElement = null;
    placeholderElement = null;
  }

  /**
   * 获取元素在容器中的索引
   * @param {HTMLElement} container - 容器元素
   * @param {HTMLElement} element - 目标元素
   * @returns {number} 索引
   */
  function getElementIndex(container, element) {
    const labels = Array.from(container.querySelectorAll('.candy-label'));
    return labels.indexOf(element);
  }

  /**
   * 启用编辑模式
   * @param {string|HTMLElement} selector - 选择器或元素
   */
  function enableEdit(selector) {
    const label = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;
    
    if (!label || !label.classList.contains('candy-label')) return;
    
    const textSpan = label.querySelector('.candy-label-text');
    if (!textSpan) return;
    
    const originalText = textSpan.dataset.originalText || textSpan.textContent;
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'candy-label-edit-input';
    input.value = originalText;
    
    // 替换文字为输入框
    textSpan.textContent = '';
    textSpan.appendChild(input);
    input.focus();
    input.select();
    
    label.classList.add('candy-label-editing');
    
    // 保存按钮
    const saveAndExit = () => {
      const newText = input.value.trim() || originalText;
      textSpan.textContent = newText;
      textSpan.dataset.originalText = newText;
      label.classList.remove('candy-label-editing');
      
      // 触发编辑完成事件
      label.dispatchEvent(new CustomEvent('edit', {
        detail: { 
          oldText: originalText, 
          newText: newText 
        },
        bubbles: true
      }));
      
      if (label._candyLabelConfig && typeof label._candyLabelConfig.onEdit === 'function') {
        label._candyLabelConfig.onEdit(newText, originalText);
      }
    };
    
    // 回车保存
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveAndExit();
      } else if (e.key === 'Escape') {
        textSpan.textContent = originalText;
        label.classList.remove('candy-label-editing');
      }
    });
    
    // 失焦保存
    input.addEventListener('blur', saveAndExit);
  }

  /**
   * 禁用编辑模式
   * @param {string|HTMLElement} selector - 选择器或元素
   */
  function disableEdit(selector) {
    const label = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;
    
    if (!label || !label.classList.contains('candy-label')) return;
    
    const textSpan = label.querySelector('.candy-label-text');
    const input = label.querySelector('.candy-label-edit-input');
    
    if (input && textSpan) {
      textSpan.textContent = textSpan.dataset.originalText || '';
      label.classList.remove('candy-label-editing');
    }
  }

  /**
   * 添加标签
   * @param {string|HTMLElement} parent - 父容器选择器或元素
   * @param {Object} options - 标签配置
   * @returns {HTMLElement} 创建的标签元素
   */
  function addTag(parent, options = {}) {
    const container = typeof parent === 'string' 
      ? document.querySelector(parent) 
      : parent;
    
    if (!container) return null;
    
    const label = create(options);
    container.appendChild(label);
    
    // 触发添加事件
    container.dispatchEvent(new CustomEvent('tagAdd', {
      detail: { element: label },
      bubbles: true
    }));
    
    return label;
  }

  /**
   * 删除标签
   * @param {string|HTMLElement} selector - 选择器或元素
   */
  function removeTag(selector) {
    const label = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;
    
    if (!label || !label.classList.contains('candy-label')) return;
    
    const container = label.parentNode;
    label.remove();
    
    // 触发删除事件
    if (container) {
      container.dispatchEvent(new CustomEvent('tagRemove', {
        detail: { element: label },
        bubbles: true
      }));
    }
  }

  /**
   * 更新标签
   * @param {string|HTMLElement} selector - 选择器或元素
   * @param {Object} options - 更新的配置
   */
  function updateTag(selector, options = {}) {
    const label = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;
    
    if (!label || !label.classList.contains('candy-label')) return;
    
    // 更新文本
    if (options.text !== undefined) {
      const textSpan = label.querySelector('.candy-label-text');
      if (textSpan) {
        textSpan.textContent = options.text;
        textSpan.dataset.originalText = options.text;
      }
    }
    
    // 更新颜色
    if (options.color !== undefined) {
      applyColor(label, options.color);
    }
    
    // 更新图标
    if (options.icon !== undefined) {
      const iconSpans = label.querySelectorAll('.candy-label-icon');
      iconSpans.forEach(icon => icon.remove());
      
      const content = label.querySelector('.candy-label-content');
      const textSpan = label.querySelector('.candy-label-text');
      const iconPosition = options.iconPosition || 'left';
      
      if (options.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = `candy-label-icon candy-label-icon-${iconPosition}`;
        iconSpan.textContent = options.icon;
        
        if (iconPosition === 'left') {
          content.insertBefore(iconSpan, textSpan);
        } else {
          content.appendChild(iconSpan);
        }
      }
    }
    
    // 更新计数
    if (options.count !== undefined) {
      let countSpan = label.querySelector('.candy-label-count');
      
      if (options.count !== null) {
        if (!countSpan) {
          countSpan = document.createElement('span');
          countSpan.className = 'candy-label-count';
          const textSpan = label.querySelector('.candy-label-text');
          content.appendChild(countSpan);
        }
        countSpan.textContent = `(${options.count})`;
      } else if (countSpan) {
        countSpan.remove();
      }
    }
    
    // 触发更新事件
    label.dispatchEvent(new CustomEvent('update', {
      detail: options,
      bubbles: true
    }));
  }

  /**
   * 获取所有标签
   * @param {string|HTMLElement} selector - 容器选择器或元素
   * @returns {Array} 标签元素数组
   */
  function getAllTags(selector) {
    const container = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;
    
    if (!container) return [];
    
    return Array.from(container.querySelectorAll('.candy-label'));
  }

  // 公开API
  return {
    create,
    setColor,
    enableDragSort,
    disableDragSort,
    enableEdit,
    disableEdit,
    addTag,
    removeTag,
    updateTag,
    getAllTags,
    colorPresets
  };
})();

// 导出为模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CandyLabel;
}
