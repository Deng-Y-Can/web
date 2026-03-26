/**
 * 完整版富文本编辑器
 */
class RichEditor {
    constructor(element, options = {}) {
        // 防止重复初始化
        if (element.hasAttribute('data-editor-initialized')) {
            console.log('编辑器已初始化，跳过');
            this.element = element;
            this.editorDiv = element.parentElement?.querySelector('.rich-editor-content');
            return;
        }

        this.element = element;
        this.elementId = element.id || 'editor-' + Date.now();
        this.options = {
            placeholder: options.placeholder || '在这里输入内容...',
            height: options.height || 400,
            uploadUrl: options.uploadUrl || '/Note/UploadFile',
            onContentChange: options.onContentChange || function () { }
        };

        this.toolbar = null;
        this.editorDiv = null;
        this.uploading = false;
        this.savedRange = null;
        this.codeViewActive = false;

        this.init();

        // 标记已初始化
        element.setAttribute('data-editor-initialized', 'true');

        // 保存到全局变量
        if (window.editorInstances === undefined) {
            window.editorInstances = {};
        }
        window.editorInstances[this.elementId] = this;
    }

    init() {
        // 隐藏原始textarea
        this.element.style.display = 'none';

        // 创建容器
        this.container = document.createElement('div');
        this.container.className = 'rich-editor-container';
        this.container.style.border = '1px solid #ddd';
        this.container.style.borderRadius = '8px';
        this.container.style.backgroundColor = '#fff';

        // 创建工具栏
        this.createToolbar();

        // 创建编辑器区域
        this.editorDiv = document.createElement('div');
        this.editorDiv.className = 'rich-editor-content';
        this.editorDiv.setAttribute('contenteditable', 'true');
        this.editorDiv.setAttribute('data-placeholder', this.options.placeholder);
        this.editorDiv.style.height = this.options.height + 'px';
        this.editorDiv.style.overflowY = 'auto';
        this.editorDiv.style.padding = '15px';
        this.editorDiv.style.fontSize = '14px';
        this.editorDiv.style.lineHeight = '1.6';
        this.editorDiv.style.fontFamily = 'inherit';
        this.editorDiv.style.outline = 'none';
        this.editorDiv.style.backgroundColor = '#fff';

        // 设置初始内容
        const originalContent = this.element.value;
        if (originalContent && originalContent !== '') {
            this.editorDiv.innerHTML = originalContent;
        }

        // 添加占位符样式
        this.updatePlaceholder();

        // 监听事件
        this.editorDiv.addEventListener('input', () => {
            this.updatePlaceholder();
            this.updateOriginalElement();
            this.options.onContentChange(this.getContent());
        });

        this.editorDiv.addEventListener('keyup', () => {
            this.updateOriginalElement();
            this.saveSelection();
        });

        this.editorDiv.addEventListener('mouseup', () => {
            this.saveSelection();
        });

        this.editorDiv.addEventListener('focus', () => {
            this.saveSelection();
        });

        // 拖拽上传
        this.setupDragAndDrop();

        // 粘贴上传
        this.setupPasteUpload();

        // 插入到DOM
        this.element.parentNode.insertBefore(this.container, this.element.nextSibling);
        this.container.appendChild(this.toolbar);
        this.container.appendChild(this.editorDiv);
    }

    createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'rich-editor-toolbar';
        this.toolbar.style.display = 'flex';
        this.toolbar.style.flexWrap = 'wrap';
        this.toolbar.style.gap = '5px';
        this.toolbar.style.padding = '10px';
        this.toolbar.style.backgroundColor = '#f8f9fa';
        this.toolbar.style.borderBottom = '1px solid #ddd';
        this.toolbar.style.borderRadius = '8px 8px 0 0';

        // 文字格式按钮
        this.addButton('bold', 'fas fa-bold', '粗体', () => this.execCommand('bold'));
        this.addButton('italic', 'fas fa-italic', '斜体', () => this.execCommand('italic'));
        this.addButton('underline', 'fas fa-underline', '下划线', () => this.execCommand('underline'));
        this.addButton('strikethrough', 'fas fa-strikethrough', '删除线', () => this.execCommand('strikethrough'));

        this.addSeparator();

        // 标题下拉
        this.addDropdown('fas fa-heading', '标题', [
            { text: '正文', command: 'formatBlock', value: '<p>' },
            { text: '标题1', command: 'formatBlock', value: '<h1>' },
            { text: '标题2', command: 'formatBlock', value: '<h2>' },
            { text: '标题3', command: 'formatBlock', value: '<h3>' }
        ]);

        this.addSeparator();

        // 对齐按钮
        this.addButton('align-left', 'fas fa-align-left', '左对齐', () => this.execCommand('justifyLeft'));
        this.addButton('align-center', 'fas fa-align-center', '居中', () => this.execCommand('justifyCenter'));
        this.addButton('align-right', 'fas fa-align-right', '右对齐', () => this.execCommand('justifyRight'));

        this.addSeparator();

        // 列表按钮
        this.addButton('list-ul', 'fas fa-list-ul', '无序列表', () => this.execCommand('insertUnorderedList'));
        this.addButton('list-ol', 'fas fa-list-ol', '有序列表', () => this.execCommand('insertOrderedList'));

        this.addSeparator();

        // 颜色选择器
        this.addColorPicker('文字颜色', 'foreColor');
        this.addColorPicker('背景颜色', 'hiliteColor');

        this.addSeparator();

        // 插入按钮
        this.addButton('link', 'fas fa-link', '插入链接', () => this.insertLink());
        this.addButton('image', 'fas fa-image', '插入图片', () => this.insertMedia('image'));
        this.addButton('video', 'fas fa-video', '插入视频', () => this.insertMedia('video'));
        this.addButton('file', 'fas fa-paperclip', '插入文件', () => this.insertMedia('file'));

        this.addSeparator();

        // 其他按钮
        this.addButton('undo', 'fas fa-undo', '撤销', () => this.execCommand('undo'));
        this.addButton('redo', 'fas fa-redo', '重做', () => this.execCommand('redo'));
        this.addButton('code', 'fas fa-code', '查看源码', () => this.toggleCodeView());
        this.addButton('remove-format', 'fas fa-eraser', '清除格式', () => this.execCommand('removeFormat'));
    }

    addButton(id, icon, title, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = `<i class="${icon}"></i>`;
        btn.title = title;
        btn.style.padding = '6px 10px';
        btn.style.border = 'none';
        btn.style.backgroundColor = 'transparent';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.style.fontSize = '14px';
        btn.style.transition = 'all 0.2s';

        btn.onmouseenter = () => btn.style.backgroundColor = '#e9ecef';
        btn.onmouseleave = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = (e) => {
            e.preventDefault();
            this.editorDiv.focus();
            onClick();
            this.updateOriginalElement();
        };

        this.toolbar.appendChild(btn);
    }

    addSeparator() {
        const sep = document.createElement('span');
        sep.style.width = '1px';
        sep.style.height = '24px';
        sep.style.backgroundColor = '#ddd';
        sep.style.margin = '0 5px';
        this.toolbar.appendChild(sep);
    }

    addDropdown(icon, title, items) {
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = `<i class="${icon}"></i> <i class="fas fa-chevron-down" style="font-size:10px; margin-left:4px;"></i>`;
        button.title = title;
        button.style.padding = '6px 10px';
        button.style.border = 'none';
        button.style.backgroundColor = 'transparent';
        button.style.cursor = 'pointer';
        button.style.borderRadius = '4px';

        const dropdown = document.createElement('div');
        dropdown.style.position = 'absolute';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.backgroundColor = 'white';
        dropdown.style.border = '1px solid #ddd';
        dropdown.style.borderRadius = '4px';
        dropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        dropdown.style.zIndex = '1000';
        dropdown.style.display = 'none';
        dropdown.style.minWidth = '100px';

        items.forEach(item => {
            const option = document.createElement('div');
            option.textContent = item.text;
            option.style.padding = '8px 12px';
            option.style.cursor = 'pointer';
            option.style.fontSize = '14px';
            option.onmouseenter = () => option.style.backgroundColor = '#f8f9fa';
            option.onmouseleave = () => option.style.backgroundColor = 'white';
            option.onclick = () => {
                this.execCommand(item.command, item.value);
                dropdown.style.display = 'none';
            };
            dropdown.appendChild(option);
        });

        button.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        container.appendChild(button);
        container.appendChild(dropdown);
        this.toolbar.appendChild(container);
    }

    addColorPicker(title, command) {
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.style.width = '32px';
        picker.style.height = '32px';
        picker.style.padding = '2px';
        picker.style.border = '1px solid #ddd';
        picker.style.borderRadius = '4px';
        picker.style.cursor = 'pointer';
        picker.title = title;
        picker.onchange = (e) => {
            this.execCommand(command, e.target.value);
        };
        this.toolbar.appendChild(picker);
    }

    execCommand(command, value = null) {
        try {
            // 保存当前选区
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                this.savedRange = selection.getRangeAt(0);
            }

            // 恢复选区
            if (this.savedRange) {
                selection.removeAllRanges();
                selection.addRange(this.savedRange);
            }

            // 执行命令
            document.execCommand(command, false, value);

            // 更新内容
            this.updateOriginalElement();
            this.options.onContentChange(this.getContent());

            // 重新聚焦
            this.editorDiv.focus();
        } catch (error) {
            console.error('执行命令失败:', error);
        }
    }

    insertLink() {
        const url = prompt('请输入链接地址:', 'https://');
        if (url) {
            this.execCommand('createLink', url);
        }
    }

    insertMedia(type) {
        const input = document.createElement('input');
        input.type = 'file';

        if (type === 'image') input.accept = 'image/*';
        else if (type === 'video') input.accept = 'video/*';
        else input.accept = '*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await this.uploadAndInsert(file, type);
        };

        input.click();
    }

    async uploadAndInsert(file, type) {
        this.showLoading(`正在上传${type === 'image' ? '图片' : type === 'video' ? '视频' : '文件'}...`);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(this.options.uploadUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            this.hideLoading();

            if (result.success) {
                this.insertMediaElement(type, result);
                this.updateOriginalElement();
                this.options.onContentChange(this.getContent());
            } else {
                alert('上传失败：' + result.message);
            }
        } catch (error) {
            this.hideLoading();
            alert('上传失败：' + error.message);
        }
    }

    insertMediaElement(type, fileInfo) {
        let html = '';

        switch (type) {
            case 'image':
                // 添加 data-filename 属性用于保存时识别
                html = `<img src="${fileInfo.url}" alt="${fileInfo.fileName}" style="max-width:100%; margin:10px 0; border-radius:4px;" data-filename="${fileInfo.fileName}" data-filesize="${fileInfo.size}" />`;
                break;
            case 'video':
                html = `
                <div style="margin:10px 0;">
                    <video controls style="max-width:100%; border-radius:4px;">
                        <source src="${fileInfo.url}">
                    </video>
                    <div style="font-size:12px; color:#999; margin-top:5px;">
                        <i class="fas fa-video"></i> ${fileInfo.fileName} (${this.formatFileSize(fileInfo.size)})
                    </div>
                </div>
            `;
                break;
            default:
                html = `
                <div style="margin:10px 0; padding:10px; background:#f5f7fa; border-radius:8px; display:inline-block;">
                    <i class="fas fa-file"></i>
                    <a href="${fileInfo.url}" download="${fileInfo.fileName}" target="_blank" style="color:#667eea; text-decoration:none;">${fileInfo.fileName}</a>
                    <span style="margin-left:10px; font-size:12px; color:#999;">(${this.formatFileSize(fileInfo.size)})</span>
                </div>
            `;
                break;
        }

        // 插入HTML
        this.execCommand('insertHTML', html);
    }

    setupDragAndDrop() {
        this.editorDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.editorDiv.style.borderColor = '#667eea';
        });

        this.editorDiv.addEventListener('dragleave', (e) => {
            this.editorDiv.style.borderColor = '#ddd';
        });

        this.editorDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.editorDiv.style.borderColor = '#ddd';

            const files = e.dataTransfer.files;
            for (let file of files) {
                const type = file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('video/') ? 'video' : 'file';
                await this.uploadAndInsert(file, type);
            }
        });
    }

    setupPasteUpload() {
        this.editorDiv.addEventListener('paste', async (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    await this.uploadAndInsert(file, 'image');
                    break;
                }
            }
        });
    }

    toggleCodeView() {
        if (this.codeViewActive) {
            this.exitCodeView();
        } else {
            this.enterCodeView();
        }
    }

    enterCodeView() {
        this.codeViewContent = this.getContent();
        this.codeViewTextarea = document.createElement('textarea');
        this.codeViewTextarea.value = this.codeViewContent;
        this.codeViewTextarea.style.width = '100%';
        this.codeViewTextarea.style.height = this.options.height + 'px';
        this.codeViewTextarea.style.padding = '15px';
        this.codeViewTextarea.style.fontFamily = 'monospace';
        this.codeViewTextarea.style.fontSize = '13px';
        this.codeViewTextarea.style.border = 'none';
        this.codeViewTextarea.style.outline = 'none';
        this.codeViewTextarea.style.resize = 'none';

        this.codeViewTextarea.oninput = () => {
            this.codeViewContent = this.codeViewTextarea.value;
        };

        this.editorDiv.style.display = 'none';
        this.editorDiv.parentNode.insertBefore(this.codeViewTextarea, this.editorDiv.nextSibling);
        this.codeViewActive = true;
    }

    exitCodeView() {
        if (this.codeViewTextarea) {
            this.setContent(this.codeViewTextarea.value);
            this.codeViewTextarea.remove();
            this.editorDiv.style.display = 'block';
            this.codeViewActive = false;
            this.updateOriginalElement();
        }
    }

    saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0);
        }
    }

    updatePlaceholder() {
        if (!this.editorDiv) return;
        const isEmpty = this.editorDiv.innerHTML === '' || this.editorDiv.innerHTML === '<br>';
        if (isEmpty) {
            this.editorDiv.classList.add('empty');
        } else {
            this.editorDiv.classList.remove('empty');
        }
    }

    updateOriginalElement() {
        this.element.value = this.getContent();
    }

    getContent() {
        return this.editorDiv ? this.editorDiv.innerHTML : '';
    }

    setContent(html) {
        if (this.editorDiv) {
            this.editorDiv.innerHTML = html || '';
            this.updatePlaceholder();
            this.updateOriginalElement();
        }
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(message) {
        this.uploading = true;
        let loadingDiv = document.getElementById('editor-loading');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'editor-loading';
            loadingDiv.style.position = 'fixed';
            loadingDiv.style.top = '50%';
            loadingDiv.style.left = '50%';
            loadingDiv.style.transform = 'translate(-50%, -50%)';
            loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
            loadingDiv.style.color = 'white';
            loadingDiv.style.padding = '20px 40px';
            loadingDiv.style.borderRadius = '8px';
            loadingDiv.style.zIndex = '10000';
            loadingDiv.style.fontSize = '14px';
            document.body.appendChild(loadingDiv);
        }
        loadingDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        loadingDiv.style.display = 'block';
    }

    hideLoading() {
        this.uploading = false;
        const loadingDiv = document.getElementById('editor-loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
    }

    destroy() {
        if (this.container) this.container.remove();
        this.element.style.display = '';
        this.element.removeAttribute('data-editor-initialized');
    }
}

// 全局变量存储编辑器实例
window.editorInstances = {};

// 获取编辑器实例
window.getEditor = function (id) {
    return window.editorInstances[id];
};

// 自动初始化
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.rich-editor-textarea').forEach(textarea => {
            if (!textarea.hasAttribute('data-editor-initialized')) {
                const editor = new RichEditor(textarea, {
                    placeholder: textarea.getAttribute('data-placeholder') || '在这里输入内容...',
                    height: parseInt(textarea.getAttribute('data-height')) || 400,
                    onContentChange: (content) => {
                        console.log('内容已更新，长度:', content.length);
                    }
                });
            }
        });
    });
}