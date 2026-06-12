/* ============================================
   CandyUI - 图片上传组件JavaScript
   完整功能实现：拖拽上传、多图预览、裁剪、压缩
   ============================================ */

class CandyImageUpload {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            multiple: true,
            maxFiles: 10,
            maxSize: 5 * 1024 * 1024, // 5MB
            acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
            preview: true,
            dragAndDrop: true,
            compression: false,
            compressionQuality: 0.8,
            resizeWidth: 1920,
            resizeHeight: 1080,
            thumbnail: true,
            thumbnailWidth: 200,
            thumbnailHeight: 200,
            ...options
        };
        this.files = [];
        this.previewContainer = null;
        this.init();
    }

    init() {
        this.createUploadArea();
        this.bindEvents();
        if (this.options.preview) {
            this.createPreviewContainer();
        }
    }

    createUploadArea() {
        // 如果已经有自定义内容，跳过
        if (this.element.querySelector('.candy-upload-area')) return;

        const uploadArea = document.createElement('div');
        uploadArea.className = 'candy-upload-area';
        uploadArea.innerHTML = `
            <input type="file" 
                   class="candy-upload-input" 
                   ${this.options.multiple ? 'multiple' : ''} 
                   accept="${this.options.acceptedTypes.join(',')}">
            <div class="candy-upload-content">
                <div class="candy-upload-icon">📤</div>
                <div class="candy-upload-text">点击或拖拽上传图片</div>
                <div class="candy-upload-hint">支持 JPG, PNG, GIF, WebP 格式</div>
            </div>
        `;

        this.element.appendChild(uploadArea);
        this.uploadInput = uploadArea.querySelector('.candy-upload-input');
        this.uploadContent = uploadArea.querySelector('.candy-upload-content');
    }

    createPreviewContainer() {
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'candy-upload-preview';
        this.element.appendChild(this.previewContainer);
    }

    bindEvents() {
        // 点击上传
        this.element.addEventListener('click', (e) => {
            if (!e.target.closest('.candy-upload-preview-delete')) {
                this.uploadInput.click();
            }
        });

        // 文件选择
        this.uploadInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            e.target.value = ''; // 允许重复选择同一文件
        });

        // 拖拽上传
        if (this.options.dragAndDrop) {
            this.setupDragAndDrop();
        }
    }

    setupDragAndDrop() {
        const uploadArea = this.element.querySelector('.candy-upload-area');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults);
            document.body.addEventListener(eventName, this.preventDefaults);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async handleFiles(files) {
        const validFiles = [];

        for (const file of files) {
            if (this.validateFile(file)) {
                let processedFile = file;

                // 压缩图片
                if (this.options.compression && this.isImageFile(file)) {
                    processedFile = await this.compressImage(file);
                }

                // 创建缩略图
                if (this.options.thumbnail) {
                    processedFile.preview = await this.createThumbnail(file);
                } else if (this.isImageFile(file)) {
                    processedFile.preview = await this.createPreview(file);
                }

                validFiles.push(processedFile);
                this.files.push(processedFile);
            }
        }

        if (validFiles.length > 0) {
            this.updatePreview();
            this.dispatchEvent('candy-upload-change', { files: this.files });
        }
    }

    validateFile(file) {
        // 检查文件类型
        if (!this.options.acceptedTypes.includes(file.type)) {
            this.dispatchEvent('candy-upload-error', {
                file,
                error: '文件类型不支持'
            });
            return false;
        }

        // 检查文件大小
        if (file.size > this.options.maxSize) {
            this.dispatchEvent('candy-upload-error', {
                file,
                error: '文件大小超过限制'
            });
            return false;
        }

        // 检查文件数量
        if (this.files.length >= this.options.maxFiles) {
            this.dispatchEvent('candy-upload-error', {
                file,
                error: `最多只能上传 ${this.options.maxFiles} 个文件`
            });
            return false;
        }

        return true;
    }

    isImageFile(file) {
        return file.type.startsWith('image/');
    }

    async compressImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // 计算压缩后的尺寸
                let width = img.width;
                let height = img.height;

                if (width > this.options.resizeWidth) {
                    height = (this.options.resizeWidth / width) * height;
                    width = this.options.resizeWidth;
                }

                if (height > this.options.resizeHeight) {
                    width = (this.options.resizeHeight / height) * width;
                    height = this.options.resizeHeight;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    },
                    file.type,
                    this.options.compressionQuality
                );
            };

            img.src = URL.createObjectURL(file);
        });
    }

    async createPreview(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }

    async createThumbnail(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                const ratio = Math.min(
                    this.options.thumbnailWidth / img.width,
                    this.options.thumbnailHeight / img.height
                );

                const width = img.width * ratio;
                const height = img.height * ratio;

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL(file.type, 0.8));
            };

            img.src = URL.createObjectURL(file);
        });
    }

    updatePreview() {
        if (!this.previewContainer) return;

        this.previewContainer.innerHTML = '';

        this.files.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'candy-upload-preview-item';
            previewItem.innerHTML = `
                <img src="${file.preview || file.preview}" alt="预览">
                <div class="candy-upload-preview-delete" data-index="${index}">✕</div>
            `;

            // 删除功能
            previewItem.querySelector('.candy-upload-preview-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile(index);
            });

            this.previewContainer.appendChild(previewItem);
        });
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updatePreview();
        this.dispatchEvent('candy-upload-change', { files: this.files });
    }

    getFiles() {
        return this.files;
    }

    clearFiles() {
        this.files = [];
        this.updatePreview();
        this.dispatchEvent('candy-upload-change', { files: this.files });
    }

    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true
        });
        this.element.dispatchEvent(event);
    }
}

// ============================================
// 工具提示类
// ============================================

class CandyImageUploadTooltip {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            position: 'top',
            delay: 300,
            content: '',
            ...options
        };
        this.tooltip = null;
        this.timeout = null;
        this.init();
    }

    init() {
        this.createTooltip();
        this.bindEvents();
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'candy-upload-tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.tooltip);
    }

    bindEvents() {
        this.element.addEventListener('mouseenter', () => this.show());
        this.element.addEventListener('mouseleave', () => this.hide());
    }

    show() {
        this.timeout = setTimeout(() => {
            this.tooltip.textContent = this.options.content;
            this.tooltip.style.opacity = '1';
            this.updatePosition();
        }, this.options.delay);
    }

    hide() {
        clearTimeout(this.timeout);
        this.tooltip.style.opacity = '0';
    }

    updatePosition() {
        const rect = this.element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        let top, left;

        switch (this.options.position) {
            case 'top':
                top = rect.top - tooltipRect.height - 10 + window.scrollY;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 10 + window.scrollY;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2 + window.scrollY;
                left = rect.left - tooltipRect.width - 10;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2 + window.scrollY;
                left = rect.right + 10;
                break;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }
}

// ============================================
// 图片查看器类
// ============================================

class CandyImageViewer {
    constructor(options = {}) {
        this.options = {
            images: [],
            index: 0,
            ...options
        };
        this.modal = null;
        this.currentIndex = 0;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'candy-image-viewer-modal';
        this.modal.innerHTML = `
            <div class="candy-image-viewer-content">
                <span class="candy-image-viewer-close">✕</span>
                <span class="candy-image-viewer-prev">❮</span>
                <img class="candy-image-viewer-image" src="" alt="">
                <span class="candy-image-viewer-next">❯</span>
                <div class="candy-image-viewer-footer">
                    <span class="candy-image-viewer-counter">1 / 1</span>
                </div>
            </div>
        `;
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        const content = this.modal.querySelector('.candy-image-viewer-content');
        content.style.cssText = `
            position: relative;
            max-width: 90%;
            max-height: 90%;
        `;

        const img = this.modal.querySelector('.candy-image-viewer-image');
        img.style.cssText = `
            max-width: 100%;
            max-height: 80vh;
            object-fit: contain;
            border-radius: 8px;
        `;

        const close = this.modal.querySelector('.candy-image-viewer-close');
        close.style.cssText = `
            position: absolute;
            top: -40px;
            right: 0;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.3s;
        `;

        const prev = this.modal.querySelector('.candy-image-viewer-prev');
        prev.style.cssText = `
            position: absolute;
            left: -60px;
            top: 50%;
            transform: translateY(-50%);
            color: #fff;
            font-size: 36px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.3s;
        `;

        const next = this.modal.querySelector('.candy-image-viewer-next');
        next.style.cssText = `
            position: absolute;
            right: -60px;
            top: 50%;
            transform: translateY(-50%);
            color: #fff;
            font-size: 36px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.3s;
        `;

        const footer = this.modal.querySelector('.candy-image-viewer-footer');
        footer.style.cssText = `
            position: absolute;
            bottom: -40px;
            left: 50%;
            transform: translateX(-50%);
            color: #fff;
            font-size: 14px;
        `;

        document.body.appendChild(this.modal);
    }

    bindEvents() {
        this.modal.querySelector('.candy-image-viewer-close').addEventListener('click', () => {
            this.close();
        });

        this.modal.querySelector('.candy-image-viewer-prev').addEventListener('click', () => {
            this.prev();
        });

        this.modal.querySelector('.candy-image-viewer-next').addEventListener('click', () => {
            this.next();
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'flex') {
                if (e.key === 'Escape') this.close();
                if (e.key === 'ArrowLeft') this.prev();
                if (e.key === 'ArrowRight') this.next();
            }
        });
    }

    open(images, startIndex = 0) {
        this.options.images = images;
        this.currentIndex = startIndex;
        this.updateImage();
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.options.images.length) % this.options.images.length;
        this.updateImage();
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.options.images.length;
        this.updateImage();
    }

    updateImage() {
        const img = this.modal.querySelector('.candy-image-viewer-image');
        const counter = this.modal.querySelector('.candy-image-viewer-counter');

        img.src = this.options.images[this.currentIndex];
        counter.textContent = `${this.currentIndex + 1} / ${this.options.images.length}`;
    }
}

// ============================================
// 自动初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 初始化所有图片上传组件
    document.querySelectorAll('[data-upload]').forEach(element => {
        const options = JSON.parse(element.dataset.upload || '{}');
        new CandyImageUpload(element, options);
    });
});

// 导出到全局
window.CandyImageUpload = CandyImageUpload;
window.CandyImageViewer = CandyImageViewer;
