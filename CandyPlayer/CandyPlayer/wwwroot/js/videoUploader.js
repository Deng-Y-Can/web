// 视频上传管理器
class VideoUploader {
    constructor(options) {
        this.options = {
            uploadUrl: '/Media/UploadVideo',
            maxFileSize: 200 * 1024 * 1024, // 200MB
            allowedTypes: ['.mp4', '.avi', '.mkv', '.mov', '.webm', '.flv', '.wmv'],
            chunkSize: 5 * 1024 * 1024, // 5MB chunks for large files
            ...options
        };

        this.uploadQueue = [];
        this.currentUpload = null;
        this.isUploading = false;
    }

    addFiles(files) {
        for (let file of files) {
            if (this.validateFile(file)) {
                this.uploadQueue.push({
                    file: file,
                    progress: 0,
                    status: 'pending',
                    xhr: null
                });
            }
        }
        this.updateFileList();
        return this.uploadQueue.length;
    }

    validateFile(file) {
        // 检查文件大小
        if (file.size > this.options.maxFileSize) {
            this.showError(`文件 ${file.name} 超过 ${this.options.maxFileSize / 1024 / 1024}MB 限制`);
            return false;
        }

        // 检查文件类型
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.options.allowedTypes.includes(ext)) {
            this.showError(`文件 ${file.name} 类型不支持，支持格式: ${this.options.allowedTypes.join(', ')}`);
            return false;
        }

        return true;
    }

    async startUpload() {
        if (this.isUploading) {
            this.showError('已有上传任务进行中');
            return;
        }

        const pendingFiles = this.uploadQueue.filter(f => f.status === 'pending');
        if (pendingFiles.length === 0) {
            this.showError('没有待上传的文件');
            return;
        }

        this.isUploading = true;

        for (let item of pendingFiles) {
            this.currentUpload = item;
            item.status = 'uploading';
            await this.uploadFile(item);
        }

        this.isUploading = false;
        this.currentUpload = null;

        // 上传完成后的回调
        if (this.options.onComplete) {
            this.options.onComplete(this.uploadQueue);
        }
    }

    async uploadFile(item) {
        const file = item.file;
        const formData = new FormData();
        formData.append('files', file);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            item.xhr = xhr;

            xhr.open('POST', this.options.uploadUrl);
            xhr.setRequestHeader('RequestVerificationToken', this.getAntiForgeryToken());

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    item.progress = percent;
                    this.updateProgress(item);
                }
            });

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        if (result.success) {
                            item.status = 'success';
                            this.updateFileItemStatus(item, 'success', result.message);
                            this.showSuccess(`${file.name} 上传成功`);
                        } else {
                            item.status = 'failed';
                            this.updateFileItemStatus(item, 'failed', result.message);
                            this.showError(`${file.name} 上传失败: ${result.message}`);
                        }
                    } catch (e) {
                        item.status = 'failed';
                        this.updateFileItemStatus(item, 'failed', '解析响应失败');
                        this.showError(`${file.name} 上传失败`);
                    }
                } else {
                    item.status = 'failed';
                    this.updateFileItemStatus(item, 'failed', `HTTP ${xhr.status}`);
                    this.showError(`${file.name} 上传失败: HTTP ${xhr.status}`);
                }
                resolve();
            };

            xhr.onerror = () => {
                item.status = 'failed';
                this.updateFileItemStatus(item, 'failed', '网络错误');
                this.showError(`${file.name} 上传失败: 网络错误`);
                resolve();
            };

            xhr.send(formData);
        });
    }

    getAntiForgeryToken() {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : '';
    }

    updateProgress(item) {
        const progressBar = document.getElementById(`progress_${this.getFileId(item.file)}`);
        if (progressBar) {
            progressBar.style.width = item.progress + '%';
            progressBar.textContent = item.progress + '%';
        }

        if (this.options.onProgress) {
            this.options.onProgress(item);
        }
    }

    updateFileItemStatus(item, status, message) {
        const statusSpan = document.getElementById(`status_${this.getFileId(item.file)}`);
        if (statusSpan) {
            statusSpan.className = `badge ${status === 'success' ? 'bg-success' : 'bg-danger'}`;
            statusSpan.textContent = status === 'success' ? '✓ 成功' : '✗ 失败';
            statusSpan.title = message || '';
        }

        if (this.options.onStatusChange) {
            this.options.onStatusChange(item, status, message);
        }
    }

    updateFileList() {
        const fileList = document.getElementById('selectedFiles');
        if (!fileList) return;

        fileList.innerHTML = '';

        this.uploadQueue.forEach(item => {
            const file = item.file;
            const fileId = this.getFileId(file);
            const fileSize = (file.size / 1024 / 1024).toFixed(2);

            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.id = `file_${fileId}`;
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                        <i class="fas fa-video me-2"></i>
                        <strong>${file.name}</strong>
                    </span>
                    <span class="badge bg-secondary">${fileSize} MB</span>
                </div>
                <div class="progress mb-2" style="height: 20px;">
                    <div id="progress_${fileId}" class="progress-bar progress-bar-striped ${item.status === 'uploading' ? 'progress-bar-animated' : ''}" 
                         style="width: ${item.progress}%">${item.progress}%</div>
                </div>
                <div class="d-flex justify-content-between">
                    <span id="status_${fileId}" class="badge ${this.getStatusBadgeClass(item.status)}">
                        ${this.getStatusText(item.status)}
                    </span>
                    <button class="btn btn-sm btn-outline-danger" onclick="videoUploader.removeFile('${fileId}')" ${item.status === 'uploading' ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> 移除
                    </button>
                </div>
            `;
            fileList.appendChild(li);
        });

        const fileListDiv = document.getElementById('fileList');
        if (fileListDiv) {
            fileListDiv.classList.toggle('d-none', this.uploadQueue.length === 0);
        }
    }

    getFileId(file) {
        return file.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + file.size;
    }

    getStatusBadgeClass(status) {
        switch (status) {
            case 'success': return 'bg-success';
            case 'failed': return 'bg-danger';
            case 'uploading': return 'bg-primary';
            default: return 'bg-secondary';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'success': return '✓ 上传成功';
            case 'failed': return '✗ 上传失败';
            case 'uploading': return '⏳ 上传中...';
            default: return '⏸ 待上传';
        }
    }

    removeFile(fileId) {
        const index = this.uploadQueue.findIndex(item => this.getFileId(item.file) === fileId);
        if (index !== -1 && this.uploadQueue[index].status !== 'uploading') {
            this.uploadQueue.splice(index, 1);
            this.updateFileList();
        }
    }

    clearQueue() {
        this.uploadQueue = [];
        this.updateFileList();
    }

    showError(message) {
        const resultDiv = document.getElementById('uploadResult');
        if (resultDiv) {
            const alertDiv = resultDiv.querySelector('.alert');
            alertDiv.className = 'alert alert-danger';
            alertDiv.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${message}`;
            resultDiv.classList.remove('d-none');
            setTimeout(() => {
                resultDiv.classList.add('d-none');
            }, 5000);
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        const resultDiv = document.getElementById('uploadResult');
        if (resultDiv) {
            const alertDiv = resultDiv.querySelector('.alert');
            alertDiv.className = 'alert alert-success';
            alertDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>${message}`;
            resultDiv.classList.remove('d-none');
            setTimeout(() => {
                resultDiv.classList.add('d-none');
            }, 3000);
        }
    }
}

// 全局实例
let videoUploader = null;