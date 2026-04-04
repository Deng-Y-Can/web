// 增强版书籍阅读器 JavaScript 类
class BookReader {
    constructor(containerId, fileUrl, fileType, fileName, fileId) {
        this.container = document.getElementById(containerId);
        this.fileUrl = fileUrl;
        this.fileType = fileType; // 'pdf' or 'txt'
        this.fileName = fileName;
        this.fileId = fileId;
        this.currentPage = 1;
        this.totalPages = 1;

        // 阅读设置
        this.settings = {
            fontSize: 16,
            lineHeight: 1.8,
            fontFamily: 'Microsoft YaHei',
            theme: 'day',
            letterSpacing: 0,
            paragraphMargin: 10,
            pageWidth: 800,
            showPageNumbers: true,
            autoSave: true
        };

        this.charsPerPage = 3000;
        this.fullContent = '';
        this.pdfDoc = null;
        this.scale = 1.5;
        this.readingProgress = 0;
        this.readingTime = 0;
        this.timer = null;

        // 加载保存的设置
        this.loadSettings();
        this.init();
    }

    loadSettings() {
        const saved = localStorage.getItem(`reader_settings_${this.fileName}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.assign(this.settings, parsed);
            } catch (e) { }
        }
    }

    saveSettings() {
        localStorage.setItem(`reader_settings_${this.fileName}`, JSON.stringify(this.settings));
    }

    init() {
        if (this.fileType === 'pdf') {
            this.loadPDF();
        } else {
            this.loadTXT();
        }
        this.createControls();
        this.startReadingTimer();
    }

    startReadingTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.readingTime++;
            this.updateReadingTimeDisplay();
        }, 1000);
    }

    updateReadingTimeDisplay() {
        const minutes = Math.floor(this.readingTime / 60);
        const seconds = this.readingTime % 60;
        const timeDisplay = document.getElementById('readingTime');
        if (timeDisplay) {
            timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    createControls() {
        const controlsHtml = `
            <div class="reader-controls" style="position: sticky; top: 0; background: #2c3e50; padding: 12px 20px; border-bottom: 1px solid #34495e; z-index: 100; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div class="row align-items-center">
                    <div class="col-md-2 mb-2 mb-md-0">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-light" id="fontMinusBtn" title="减小字体" style="background: #ecf0f1; color: #2c3e50;">A-</button>
                            <span class="px-2 text-white" id="fontSizeDisplay">${this.settings.fontSize}px</span>
                            <button class="btn btn-sm btn-light" id="fontPlusBtn" title="增大字体" style="background: #ecf0f1; color: #2c3e50;">A+</button>
                        </div>
                    </div>
                    <div class="col-md-2 mb-2 mb-md-0">
                        <select id="fontFamilySelect" class="form-select form-select-sm" style="background: #ecf0f1; color: #2c3e50; border: none;">
                            <option value="Microsoft YaHei" ${this.settings.fontFamily === 'Microsoft YaHei' ? 'selected' : ''}>微软雅黑</option>
                            <option value="SimSun" ${this.settings.fontFamily === 'SimSun' ? 'selected' : ''}>宋体</option>
                            <option value="SimHei" ${this.settings.fontFamily === 'SimHei' ? 'selected' : ''}>黑体</option>
                            <option value="KaiTi" ${this.settings.fontFamily === 'KaiTi' ? 'selected' : ''}>楷体</option>
                            <option value="Arial" ${this.settings.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                        </select>
                    </div>
                    <div class="col-md-2 mb-2 mb-md-0">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-light" data-theme="day" title="白天模式" style="background: #ecf0f1; color: #2c3e50;">☀️</button>
                            <button class="btn btn-sm btn-light" data-theme="night" title="夜间模式" style="background: #ecf0f1; color: #2c3e50;">🌙</button>
                            <button class="btn btn-sm btn-light" data-theme="eye" title="护眼模式" style="background: #ecf0f1; color: #2c3e50;">👁️</button>
                            <button class="btn btn-sm btn-light" data-theme="sepia" title="复古模式" style="background: #ecf0f1; color: #2c3e50;">📜</button>
                        </div>
                    </div>
                    <div class="col-md-2 mb-2 mb-md-0">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-light" id="lineHeightMinusBtn" title="减小行距" style="background: #ecf0f1; color: #2c3e50;">行距-</button>
                            <span class="px-2 text-white" id="lineHeightDisplay">${this.settings.lineHeight.toFixed(1)}</span>
                            <button class="btn btn-sm btn-light" id="lineHeightPlusBtn" title="增大行距" style="background: #ecf0f1; color: #2c3e50;">行距+</button>
                        </div>
                    </div>
                    <div class="col-md-2 mb-2 mb-md-0">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-light" id="letterSpacingMinusBtn" title="减小字间距" style="background: #ecf0f1; color: #2c3e50;">字距-</button>
                            <span class="px-2 text-white" id="letterSpacingDisplay">${this.settings.letterSpacing}px</span>
                            <button class="btn btn-sm btn-light" id="letterSpacingPlusBtn" title="增大字间距" style="background: #ecf0f1; color: #2c3e50;">字距+</button>
                        </div>
                    </div>
                    <div class="col-md-2 text-md-end">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-light" id="fullscreenBtn" title="全屏模式" style="background: #ecf0f1; color: #2c3e50;">📺 全屏</button>
                            <button class="btn btn-sm btn-light" id="resetSettingsBtn" title="重置设置" style="background: #ecf0f1; color: #2c3e50;">↺ 重置</button>
                        </div>
                        <span class="ms-2 text-white small">
                            <i class="fas fa-clock"></i> <span id="readingTime">00:00</span>
                        </span>
                    </div>
                </div>
            </div>
            <div id="readerContent" style="padding: 30px; min-height: 600px; transition: all 0.3s ease;"></div>
            <div id="paginationControls" class="text-center mt-3 pb-4" style="display: none;">
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" id="firstPageBtn" title="首页">⏮ 首页</button>
                    <button class="btn btn-sm btn-primary" id="prevPageBtn" title="上一页">◀ 上一页</button>
                    <span class="mx-3 align-self-center" id="pageInfo">第1页 / 共1页</span>
                    <button class="btn btn-sm btn-primary" id="nextPageBtn" title="下一页">下一页 ▶</button>
                    <button class="btn btn-sm btn-primary" id="lastPageBtn" title="尾页">尾页 ⏭</button>
                </div>
                <div class="mt-2">
                    <div class="d-inline-block">
                        <input type="number" id="pageInput" class="form-control d-inline-block" style="width: 80px;" min="1" />
                        <button class="btn btn-sm btn-primary" id="jumpPageBtn">跳转</button>
                    </div>
                </div>
                <div class="mt-3">
                    <div class="progress" style="height: 8px; max-width: 400px; margin: 0 auto;">
                        <div id="readingProgress" class="progress-bar bg-primary" style="width: 0%"></div>
                    </div>
                    <small class="text-muted" id="progressText">阅读进度: 0%</small>
                </div>
            </div>
            <div id="bookmarkPanel" class="position-fixed bottom-0 end-0 m-3" style="z-index: 1000;">
                <button class="btn btn-sm btn-warning rounded-circle shadow" id="addBookmarkBtn" title="添加书签" style="width: 45px; height: 45px;">
                    <i class="fas fa-bookmark"></i>
                </button>
            </div>
        `;
        this.container.innerHTML = controlsHtml;

        this.bindEvents();
    }

    bindEvents() {
        // 字体控制
        document.getElementById('fontMinusBtn')?.addEventListener('click', () => this.changeFontSize(-2));
        document.getElementById('fontPlusBtn')?.addEventListener('click', () => this.changeFontSize(2));
        document.getElementById('fontFamilySelect')?.addEventListener('change', (e) => this.changeFontFamily(e.target.value));

        // 行距控制
        document.getElementById('lineHeightMinusBtn')?.addEventListener('click', () => this.changeLineHeight(-0.1));
        document.getElementById('lineHeightPlusBtn')?.addEventListener('click', () => this.changeLineHeight(0.1));

        // 字间距控制
        document.getElementById('letterSpacingMinusBtn')?.addEventListener('click', () => this.changeLetterSpacing(-0.5));
        document.getElementById('letterSpacingPlusBtn')?.addEventListener('click', () => this.changeLetterSpacing(0.5));

        // 主题切换
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => this.changeTheme(btn.getAttribute('data-theme')));
        });

        // 其他控制
        document.getElementById('fullscreenBtn')?.addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('resetSettingsBtn')?.addEventListener('click', () => this.resetSettings());
        document.getElementById('addBookmarkBtn')?.addEventListener('click', () => this.addBookmark());

        // 分页控制
        document.getElementById('firstPageBtn')?.addEventListener('click', () => this.firstPage());
        document.getElementById('prevPageBtn')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPageBtn')?.addEventListener('click', () => this.nextPage());
        document.getElementById('lastPageBtn')?.addEventListener('click', () => this.lastPage());
        document.getElementById('jumpPageBtn')?.addEventListener('click', () => this.jumpToPage());

        // 更新显示
        this.updateDisplays();
    }

    updateDisplays() {
        document.getElementById('fontSizeDisplay').textContent = this.settings.fontSize + 'px';
        document.getElementById('lineHeightDisplay').textContent = this.settings.lineHeight.toFixed(1);
        document.getElementById('letterSpacingDisplay').textContent = this.settings.letterSpacing + 'px';
    }

    loadPDF() {
        if (typeof pdfjsLib === 'undefined') {
            document.getElementById('readerContent').innerHTML = '<div class="alert alert-danger">PDF.js 库未加载，请检查网络连接。</div>';
            return;
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

        pdfjsLib.getDocument(this.fileUrl).promise.then(pdf => {
            this.pdfDoc = pdf;
            this.totalPages = pdf.numPages;
            document.getElementById('paginationControls').style.display = 'block';

            const savedPage = localStorage.getItem(`bookmark_page_${this.fileName}`);
            if (savedPage && parseInt(savedPage) > 0 && parseInt(savedPage) <= this.totalPages) {
                if (confirm(`您上次阅读到第 ${savedPage} 页，是否继续？`)) {
                    this.currentPage = parseInt(savedPage);
                }
            }

            this.renderPDFPage(this.currentPage);
            this.loadBookmarks();
        }).catch(error => {
            document.getElementById('readerContent').innerHTML = `<div class="alert alert-danger">PDF加载失败：${error.message}</div>`;
        });
    }

    renderPDFPage(pageNum) {
        if (!this.pdfDoc) return;

        this.pdfDoc.getPage(pageNum).then(page => {
            const viewport = page.getViewport({ scale: this.scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.maxWidth = '100%';
            canvas.style.height = 'auto';

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            page.render(renderContext);

            const readerContent = document.getElementById('readerContent');
            readerContent.innerHTML = '';
            readerContent.appendChild(canvas);

            this.updatePaginationDisplay();
            this.updateProgress();
            this.savePosition();
        });
    }

    loadTXT() {
        fetch(this.fileUrl)
            .then(response => response.text())
            .then(text => {
                this.fullContent = text;
                this.totalPages = Math.ceil(this.fullContent.length / this.charsPerPage);
                document.getElementById('paginationControls').style.display = 'block';

                const savedPage = localStorage.getItem(`bookmark_page_${this.fileName}`);
                if (savedPage && parseInt(savedPage) > 0 && parseInt(savedPage) <= this.totalPages) {
                    if (confirm(`您上次阅读到第 ${savedPage} 页，是否继续？`)) {
                        this.currentPage = parseInt(savedPage);
                    }
                }

                this.renderTXTPage();
                this.loadBookmarks();
            })
            .catch(error => {
                document.getElementById('readerContent').innerHTML = `<div class="alert alert-danger">TXT加载失败：${error.message}</div>`;
            });
    }

    renderTXTPage() {
        const start = (this.currentPage - 1) * this.charsPerPage;
        const end = Math.min(start + this.charsPerPage, this.fullContent.length);
        let pageContent = this.fullContent.substring(start, end);

        pageContent = pageContent.replace(/\n/g, '<br>');

        const readerContent = document.getElementById('readerContent');
        readerContent.innerHTML = `<div class="txt-content" style="max-width: 800px; margin: 0 auto; text-align: justify;">${pageContent}</div>`;

        this.updatePaginationDisplay();
        this.updateProgress();
        this.applyStyles();
        this.savePosition();
    }

    applyStyles() {
        const content = document.getElementById('readerContent');
        if (content) {
            content.style.fontSize = this.settings.fontSize + 'px';
            content.style.lineHeight = this.settings.lineHeight;
            content.style.fontFamily = this.settings.fontFamily;
            content.style.letterSpacing = this.settings.letterSpacing + 'px';

            // 段落样式
            const paragraphs = content.querySelectorAll('.txt-content');
            paragraphs.forEach(p => {
                p.style.marginBottom = this.settings.paragraphMargin + 'px';
            });

            // 主题样式
            const themes = {
                day: { background: '#ffffff', color: '#333333', border: '#e0e0e0' },
                night: { background: '#1a1a2e', color: '#ecf0f1', border: '#2c3e50' },
                eye: { background: '#c7edcc', color: '#2c3e50', border: '#a0c4a8' },
                sepia: { background: '#f4ecd8', color: '#5b4636', border: '#d4c5a8' }
            };
            const theme = themes[this.settings.theme];
            content.style.backgroundColor = theme.background;
            content.style.color = theme.color;
        }
    }

    updatePaginationDisplay() {
        document.getElementById('pageInfo').innerHTML = `第${this.currentPage}页 / 共${this.totalPages}页`;
        document.getElementById('pageInput').value = this.currentPage;
    }

    updateProgress() {
        const progress = (this.currentPage / this.totalPages) * 100;
        const progressBar = document.getElementById('readingProgress');
        const progressText = document.getElementById('progressText');
        if (progressBar) {
            progressBar.style.width = progress + '%';
            progressBar.textContent = Math.round(progress) + '%';
        }
        if (progressText) {
            progressText.textContent = `阅读进度: ${Math.round(progress)}%`;
        }
        this.readingProgress = progress;
    }

    savePosition() {
        if (this.settings.autoSave) {
            localStorage.setItem(`bookmark_page_${this.fileName}`, this.currentPage);
        }
    }

    loadBookmarks() {
        const bookmarks = localStorage.getItem(`bookmarks_${this.fileName}`);
        if (bookmarks) {
            try {
                const marks = JSON.parse(bookmarks);
                this.showBookmarks(marks);
            } catch (e) { }
        }
    }

    addBookmark() {
        let bookmarks = localStorage.getItem(`bookmarks_${this.fileName}`);
        let marks = bookmarks ? JSON.parse(bookmarks) : [];

        const bookmark = {
            page: this.currentPage,
            time: new Date().toLocaleString(),
            note: prompt('添加书签备注（可选）：', `第${this.currentPage}页`)
        };

        marks.push(bookmark);
        localStorage.setItem(`bookmarks_${this.fileName}`, JSON.stringify(marks));
        alert(`书签已添加！第${this.currentPage}页`);
        this.showBookmarks(marks);
    }

    showBookmarks(marks) {
        console.log('书签列表:', marks);
    }

    changeFontSize(delta) {
        this.settings.fontSize += delta;
        if (this.settings.fontSize < 12) this.settings.fontSize = 12;
        if (this.settings.fontSize > 36) this.settings.fontSize = 36;
        this.applyStyles();
        this.updateDisplays();
        this.saveSettings();
    }

    changeFontFamily(family) {
        this.settings.fontFamily = family;
        this.applyStyles();
        this.saveSettings();
    }

    changeTheme(theme) {
        this.settings.theme = theme;
        this.applyStyles();
        this.saveSettings();
    }

    changeLineHeight(delta) {
        this.settings.lineHeight += delta;
        if (this.settings.lineHeight < 1.2) this.settings.lineHeight = 1.2;
        if (this.settings.lineHeight > 2.5) this.settings.lineHeight = 2.5;
        this.applyStyles();
        this.updateDisplays();
        this.saveSettings();
    }

    changeLetterSpacing(delta) {
        this.settings.letterSpacing += delta;
        if (this.settings.letterSpacing < -1) this.settings.letterSpacing = -1;
        if (this.settings.letterSpacing > 3) this.settings.letterSpacing = 3;
        this.applyStyles();
        this.updateDisplays();
        this.saveSettings();
    }

    changeParagraphMargin(delta) {
        this.settings.paragraphMargin += delta;
        if (this.settings.paragraphMargin < 0) this.settings.paragraphMargin = 0;
        if (this.settings.paragraphMargin > 30) this.settings.paragraphMargin = 30;
        this.applyStyles();
        this.saveSettings();
    }

    resetSettings() {
        this.settings = {
            fontSize: 16,
            lineHeight: 1.8,
            fontFamily: 'Microsoft YaHei',
            theme: 'day',
            letterSpacing: 0,
            paragraphMargin: 10,
            pageWidth: 800,
            showPageNumbers: true,
            autoSave: true
        };
        this.applyStyles();
        this.updateDisplays();
        this.saveSettings();
        alert('阅读设置已重置');
    }

    firstPage() {
        this.currentPage = 1;
        if (this.fileType === 'pdf') {
            this.renderPDFPage(this.currentPage);
        } else {
            this.renderTXTPage();
        }
        window.scrollTo(0, 0);
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            if (this.fileType === 'pdf') {
                this.renderPDFPage(this.currentPage);
            } else {
                this.renderTXTPage();
            }
            window.scrollTo(0, 0);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            if (this.fileType === 'pdf') {
                this.renderPDFPage(this.currentPage);
            } else {
                this.renderTXTPage();
            }
            window.scrollTo(0, 0);
        }
    }

    lastPage() {
        this.currentPage = this.totalPages;
        if (this.fileType === 'pdf') {
            this.renderPDFPage(this.currentPage);
        } else {
            this.renderTXTPage();
        }
        window.scrollTo(0, 0);
    }

    jumpToPage() {
        const page = parseInt(document.getElementById('pageInput').value);
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            if (this.fileType === 'pdf') {
                this.renderPDFPage(this.currentPage);
            } else {
                this.renderTXTPage();
            }
            window.scrollTo(0, 0);
        }
    }

    toggleFullscreen() {
        const elem = this.container;
        if (!document.fullscreenElement) {
            elem.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.bookReader === 'undefined') {
        window.bookReader = null;
    }
});