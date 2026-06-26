class BookReader {
    constructor(containerId, fileUrl, fileType, fileName, fileId) {
        this.container = document.getElementById(containerId);
        this.fileUrl = fileUrl;
        this.fileType = fileType;
        this.fileName = fileName;
        this.fileId = fileId;
        this.currentPage = 1;
        this.totalPages = 1;

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this.settings = {
            fontSize: this.isMobile ? 18 : 16,
            lineHeight: 1.8,
            fontFamily: 'Microsoft YaHei',
            theme: 'day',
            letterSpacing: 0,
            paragraphMargin: 10,
            pageWidth: this.isMobile ? '100%' : 800,
            showPageNumbers: true,
            autoSave: true
        };

        this.charsPerPage = this.isMobile ? 1800 : 3000;
        this.fullContent = '';
        this.readingProgress = 0;
        this.readingTime = 0;
        this.timer = null;

        this.touchStartX = 0;
        this.touchEndX = 0;

        this.loadSettings();
        this.init();
    }

    loadSettings() {
        const saved = localStorage.getItem('reader_settings_' + this.fileName);
        if (saved) {
            try {
                Object.assign(this.settings, JSON.parse(saved));
            } catch (e) { }
        }
    }

    saveSettings() {
        localStorage.setItem('reader_settings_' + this.fileName, JSON.stringify(this.settings));
    }

    init() {
        if (this.fileType === 'pdf') {
            this.loadPDFNative();
        } else {
            this.loadTXT();
        }
        this.createControls();
        this.startReadingTimer();
        this.initTouchSwipe();
    }

    initTouchSwipe() {
        if (!this.isMobile) return;
        const content = document.getElementById('readerContent');
        if (!content) return;

        content.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        content.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });
    }

    handleSwipe() {
        const diff = this.touchEndX - this.touchStartX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                this.previousPage();
            } else {
                this.nextPage();
            }
        }
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
        const el = document.getElementById('readingTime');
        if (el) {
            el.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }
    }

    createControls() {
        var controlsHtml = '';

        if (this.isMobile) {
            controlsHtml = '<div class="reader-controls" style="position:sticky;top:0;background:#2c3e50;padding:10px;border-bottom:1px solid #34495e;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,0.1);">' +
                '<div class="d-flex justify-content-around mb-2">' +
                    '<div class="btn-group">' +
                        '<button class="btn btn-sm btn-light" id="fontMinusBtn" style="font-size:1.2rem;padding:8px 12px;">A-</button>' +
                        '<span class="px-2 text-white align-self-center" id="fontSizeDisplay" style="min-width:50px;">' + this.settings.fontSize + 'px</span>' +
                        '<button class="btn btn-sm btn-light" id="fontPlusBtn" style="font-size:1.2rem;padding:8px 12px;">A+</button>' +
                    '</div>' +
                    '<div class="btn-group">' +
                        '<button class="btn btn-sm btn-light" id="lineHeightMinusBtn" style="padding:8px 12px;">行距-</button>' +
                        '<span class="px-2 text-white align-self-center" id="lineHeightDisplay" style="min-width:40px;">' + this.settings.lineHeight.toFixed(1) + '</span>' +
                        '<button class="btn btn-sm btn-light" id="lineHeightPlusBtn" style="padding:8px 12px;">行距+</button>' +
                    '</div>' +
                '</div>' +
                '<div class="d-flex justify-content-around mb-2">' +
                    '<select id="fontFamilySelect" class="form-select form-select-sm" style="background:#ecf0f1;color:#2c3e50;border:none;font-size:0.9rem;width:auto;">' +
                        '<option value="Microsoft YaHei"' + (this.settings.fontFamily === 'Microsoft YaHei' ? ' selected' : '') + '>微软雅黑</option>' +
                        '<option value="SimSun"' + (this.settings.fontFamily === 'SimSun' ? ' selected' : '') + '>宋体</option>' +
                        '<option value="SimHei"' + (this.settings.fontFamily === 'SimHei' ? ' selected' : '') + '>黑体</option>' +
                        '<option value="KaiTi"' + (this.settings.fontFamily === 'KaiTi' ? ' selected' : '') + '>楷体</option>' +
                    '</select>' +
                    '<div class="btn-group">' +
                        '<button class="btn btn-sm btn-light" data-theme="day" style="padding:8px 10px;">☀️</button>' +
                        '<button class="btn btn-sm btn-light" data-theme="night" style="padding:8px 10px;">🌙</button>' +
                        '<button class="btn btn-sm btn-light" data-theme="eye" style="padding:8px 10px;">👁️</button>' +
                        '<button class="btn btn-sm btn-light" data-theme="sepia" style="padding:8px 10px;">📜</button>' +
                    '</div>' +
                '</div>' +
                '<div class="d-flex justify-content-between align-items-center">' +
                    '<div class="btn-group">' +
                        '<button class="btn btn-sm btn-primary" id="prevPageBtn" style="padding:6px 12px;">◀</button>' +
                        '<span class="mx-2 text-white" id="pageInfo" style="font-size:0.9rem;">' + this.currentPage + '/' + this.totalPages + '</span>' +
                        '<button class="btn btn-sm btn-primary" id="nextPageBtn" style="padding:6px 12px;">▶</button>' +
                    '</div>' +
                    '<button class="btn btn-sm btn-primary" id="resetSettingsBtn" style="padding:6px 12px;">重置</button>' +
                    '<div class="d-flex align-items-center">' +
                        '<i class="fas fa-clock text-white me-1" style="font-size:0.8rem;"></i>' +
                        '<span class="text-white small" id="readingTime">00:00</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div id="readerContent" style="padding:20px 15px;min-height:60vh;transition:all 0.3s ease;"></div>' +
            '<div id="paginationControls" class="text-center mt-3 pb-4" style="display:none;">' +
                '<div class="d-flex justify-content-center align-items-center gap-2 mb-2">' +
                    '<button class="btn btn-sm btn-primary" id="firstPageBtn">首页</button>' +
                    '<button class="btn btn-sm btn-primary" id="lastPageBtn">尾页</button>' +
                '</div>' +
                '<div class="d-flex justify-content-center align-items-center gap-2">' +
                    '<input type="number" id="pageInput" class="form-control" style="width:80px;text-align:center;" min="1" />' +
                    '<button class="btn btn-sm btn-primary" id="jumpPageBtn">跳转</button>' +
                '</div>' +
                '<div class="mt-3 px-3">' +
                    '<div class="progress" style="height:6px;">' +
                        '<div id="readingProgress" class="progress-bar bg-primary" style="width:0%"></div>' +
                    '</div>' +
                    '<small class="text-muted" id="progressText">阅读进度: 0%</small>' +
                '</div>' +
            '</div>' +
            '<div id="bookmarkPanel" class="position-fixed bottom-0 end-0 m-3" style="z-index:1000;">' +
                '<button class="btn btn-warning rounded-circle shadow" id="addBookmarkBtn" style="width:50px;height:50px;font-size:1.2rem;">' +
                    '<i class="fas fa-bookmark"></i>' +
                '</button>' +
            '</div>';
        } else {
            controlsHtml = '<div class="reader-controls" style="position:sticky;top:0;background:#2c3e50;padding:12px 20px;border-bottom:1px solid #34495e;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,0.1);">' +
                '<div class="row align-items-center">' +
                    '<div class="col-md-2 mb-2 mb-md-0">' +
                        '<div class="btn-group">' +
                            '<button class="btn btn-sm btn-light" id="fontMinusBtn" title="减小字体" style="background:#ecf0f1;color:#2c3e50;">A-</button>' +
                            '<span class="px-2 text-white" id="fontSizeDisplay">' + this.settings.fontSize + 'px</span>' +
                            '<button class="btn btn-sm btn-light" id="fontPlusBtn" title="增大字体" style="background:#ecf0f1;color:#2c3e50;">A+</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-md-2 mb-2 mb-md-0">' +
                        '<select id="fontFamilySelect" class="form-select form-select-sm" style="background:#ecf0f1;color:#2c3e50;border:none;">' +
                            '<option value="Microsoft YaHei"' + (this.settings.fontFamily === 'Microsoft YaHei' ? ' selected' : '') + '>微软雅黑</option>' +
                            '<option value="SimSun"' + (this.settings.fontFamily === 'SimSun' ? ' selected' : '') + '>宋体</option>' +
                            '<option value="SimHei"' + (this.settings.fontFamily === 'SimHei' ? ' selected' : '') + '>黑体</option>' +
                            '<option value="KaiTi"' + (this.settings.fontFamily === 'KaiTi' ? ' selected' : '') + '>楷体</option>' +
                            '<option value="Arial"' + (this.settings.fontFamily === 'Arial' ? ' selected' : '') + '>Arial</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="col-md-2 mb-2 mb-md-0">' +
                        '<div class="btn-group">' +
                            '<button class="btn btn-sm btn-light" data-theme="day" title="白天模式" style="background:#ecf0f1;color:#2c3e50;">☀️</button>' +
                            '<button class="btn btn-sm btn-light" data-theme="night" title="夜间模式" style="background:#ecf0f1;color:#2c3e50;">🌙</button>' +
                            '<button class="btn btn-sm btn-light" data-theme="eye" title="护眼模式" style="background:#ecf0f1;color:#2c3e50;">👁️</button>' +
                            '<button class="btn btn-sm btn-light" data-theme="sepia" title="复古模式" style="background:#ecf0f1;color:#2c3e50;">📜</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-md-2 mb-2 mb-md-0">' +
                        '<div class="btn-group">' +
                            '<button class="btn btn-sm btn-light" id="lineHeightMinusBtn" title="减小行距" style="background:#ecf0f1;color:#2c3e50;">行距-</button>' +
                            '<span class="px-2 text-white" id="lineHeightDisplay">' + this.settings.lineHeight.toFixed(1) + '</span>' +
                            '<button class="btn btn-sm btn-light" id="lineHeightPlusBtn" title="增大行距" style="background:#ecf0f1;color:#2c3e50;">行距+</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-md-2 mb-2 mb-md-0">' +
                        '<div class="btn-group">' +
                            '<button class="btn btn-sm btn-light" id="letterSpacingMinusBtn" title="减小字间距" style="background:#ecf0f1;color:#2c3e50;">字距-</button>' +
                            '<span class="px-2 text-white" id="letterSpacingDisplay">' + this.settings.letterSpacing + 'px</span>' +
                            '<button class="btn btn-sm btn-light" id="letterSpacingPlusBtn" title="增大字间距" style="background:#ecf0f1;color:#2c3e50;">字距+</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-md-2 text-md-end">' +
                        '<div class="btn-group">' +
                            '<button class="btn btn-sm btn-light" id="fullscreenBtn" title="全屏模式" style="background:#ecf0f1;color:#2c3e50;">📺 全屏</button>' +
                            '<button class="btn btn-sm btn-light" id="resetSettingsBtn" title="重置设置" style="background:#ecf0f1;color:#2c3e50;">↺ 重置</button>' +
                        '</div>' +
                        '<span class="ms-2 text-white small">' +
                            '<i class="fas fa-clock"></i> <span id="readingTime">00:00</span>' +
                        '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div id="readerContent" style="padding:30px;min-height:600px;transition:all 0.3s ease;"></div>' +
            '<div id="paginationControls" class="text-center mt-3 pb-4" style="display:none;">' +
                '<div class="btn-group">' +
                    '<button class="btn btn-sm btn-primary" id="firstPageBtn" title="首页">⏮ 首页</button>' +
                    '<button class="btn btn-sm btn-primary" id="prevPageBtn" title="上一页">◀ 上一页</button>' +
                    '<span class="mx-3 align-self-center" id="pageInfo">第1页 / 共1页</span>' +
                    '<button class="btn btn-sm btn-primary" id="nextPageBtn" title="下一页">下一页 ▶</button>' +
                    '<button class="btn btn-sm btn-primary" id="lastPageBtn" title="尾页">尾页 ⏭</button>' +
                '</div>' +
                '<div class="mt-2">' +
                    '<div class="d-inline-block">' +
                        '<input type="number" id="pageInput" class="form-control d-inline-block" style="width:80px;" min="1" />' +
                        '<button class="btn btn-sm btn-primary" id="jumpPageBtn">跳转</button>' +
                    '</div>' +
                '</div>' +
                '<div class="mt-3">' +
                    '<div class="progress" style="height:8px;max-width:400px;margin:0 auto;">' +
                        '<div id="readingProgress" class="progress-bar bg-primary" style="width:0%"></div>' +
                    '</div>' +
                    '<small class="text-muted" id="progressText">阅读进度: 0%</small>' +
                '</div>' +
            '</div>' +
            '<div id="bookmarkPanel" class="position-fixed bottom-0 end-0 m-3" style="z-index:1000;">' +
                '<button class="btn btn-sm btn-warning rounded-circle shadow" id="addBookmarkBtn" title="添加书签" style="width:45px;height:45px;">' +
                    '<i class="fas fa-bookmark"></i>' +
                '</button>' +
            '</div>';
        }

        this.container.innerHTML = controlsHtml;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('fontMinusBtn') && document.getElementById('fontMinusBtn').addEventListener('click', () => this.changeFontSize(-2));
        document.getElementById('fontPlusBtn') && document.getElementById('fontPlusBtn').addEventListener('click', () => this.changeFontSize(2));
        document.getElementById('fontFamilySelect') && document.getElementById('fontFamilySelect').addEventListener('change', (e) => this.changeFontFamily(e.target.value));
        document.getElementById('lineHeightMinusBtn') && document.getElementById('lineHeightMinusBtn').addEventListener('click', () => this.changeLineHeight(-0.1));
        document.getElementById('lineHeightPlusBtn') && document.getElementById('lineHeightPlusBtn').addEventListener('click', () => this.changeLineHeight(0.1));

        if (!this.isMobile) {
            document.getElementById('letterSpacingMinusBtn') && document.getElementById('letterSpacingMinusBtn').addEventListener('click', () => this.changeLetterSpacing(-0.5));
            document.getElementById('letterSpacingPlusBtn') && document.getElementById('letterSpacingPlusBtn').addEventListener('click', () => this.changeLetterSpacing(0.5));
            document.getElementById('fullscreenBtn') && document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
        }

        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => this.changeTheme(btn.getAttribute('data-theme')));
        });

        document.getElementById('resetSettingsBtn') && document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());
        document.getElementById('addBookmarkBtn') && document.getElementById('addBookmarkBtn').addEventListener('click', () => this.addBookmark());
        document.getElementById('firstPageBtn') && document.getElementById('firstPageBtn').addEventListener('click', () => this.firstPage());
        document.getElementById('prevPageBtn') && document.getElementById('prevPageBtn').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPageBtn') && document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());
        document.getElementById('lastPageBtn') && document.getElementById('lastPageBtn').addEventListener('click', () => this.lastPage());
        document.getElementById('jumpPageBtn') && document.getElementById('jumpPageBtn').addEventListener('click', () => this.jumpToPage());

        var pageInput = document.getElementById('pageInput');
        if (pageInput) {
            pageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.jumpToPage();
            });
        }

        this.updateDisplays();
    }

    updateDisplays() {
        var fontSizeDisplay = document.getElementById('fontSizeDisplay');
        var lineHeightDisplay = document.getElementById('lineHeightDisplay');
        if (fontSizeDisplay) fontSizeDisplay.textContent = this.settings.fontSize + 'px';
        if (lineHeightDisplay) lineHeightDisplay.textContent = this.settings.lineHeight.toFixed(1);
        if (!this.isMobile) {
            var letterSpacingDisplay = document.getElementById('letterSpacingDisplay');
            if (letterSpacingDisplay) letterSpacingDisplay.textContent = this.settings.letterSpacing + 'px';
        }
    }

    loadPDFNative() {
        var readerContent = document.getElementById('readerContent');
        var paginationControls = document.getElementById('paginationControls');

        readerContent.innerHTML = '';

        var iframe = document.createElement('iframe');
        iframe.src = this.fileUrl;
        iframe.style.width = '100%';
        iframe.style.height = '75vh';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '4px';

        if (this.isMobile) {
            iframe.style.height = '80vh';
        }

        readerContent.appendChild(iframe);

        paginationControls.style.display = 'none';

        var savedPage = localStorage.getItem('bookmark_page_' + this.fileName);
        if (savedPage) {
            this.currentPage = parseInt(savedPage);
        }

        this.loadBookmarks();
    }

    loadTXT() {
        fetch(this.fileUrl)
            .then(response => response.text())
            .then(text => {
                this.fullContent = text;
                this.totalPages = Math.ceil(this.fullContent.length / this.charsPerPage);
                document.getElementById('paginationControls').style.display = 'block';

                var savedPage = localStorage.getItem('bookmark_page_' + this.fileName);
                if (savedPage && parseInt(savedPage) > 0 && parseInt(savedPage) <= this.totalPages) {
                    if (confirm('您上次阅读到第 ' + savedPage + ' 页，是否继续？')) {
                        this.currentPage = parseInt(savedPage);
                    }
                }

                this.renderTXTPage();
                this.loadBookmarks();
            })
            .catch(error => {
                document.getElementById('readerContent').innerHTML = '<div class="alert alert-danger">TXT加载失败：' + error.message + '</div>';
            });
    }

    renderTXTPage() {
        var start = (this.currentPage - 1) * this.charsPerPage;
        var end = Math.min(start + this.charsPerPage, this.fullContent.length);
        var pageContent = this.fullContent.substring(start, end);
        pageContent = pageContent.replace(/\n/g, '<br>');

        var readerContent = document.getElementById('readerContent');
        var maxWidth = this.isMobile ? '100%' : '800px';
        var padding = this.isMobile ? '0' : '0 20px';

        readerContent.innerHTML = '<div class="txt-content" style="max-width:' + maxWidth + ';margin:0 auto;text-align:justify;padding:' + padding + ';">' + pageContent + '</div>';

        this.updatePaginationDisplay();
        this.updateProgress();
        this.applyStyles();
        this.savePosition();
    }

    applyStyles() {
        var content = document.getElementById('readerContent');
        if (!content) return;

        content.style.fontSize = this.settings.fontSize + 'px';
        content.style.lineHeight = this.settings.lineHeight;
        content.style.fontFamily = this.settings.fontFamily;
        content.style.letterSpacing = this.settings.letterSpacing + 'px';

        if (this.isMobile) {
            content.style.padding = '20px 15px';
            content.style.touchAction = 'pan-y pinch-zoom';
        }

        var themes = {
            day: { background: '#ffffff', color: '#333333' },
            night: { background: '#1a1a2e', color: '#ecf0f1' },
            eye: { background: '#c7edcc', color: '#2c3e50' },
            sepia: { background: '#f4ecd8', color: '#5b4636' }
        };
        var theme = themes[this.settings.theme];
        if (theme) {
            content.style.backgroundColor = theme.background;
            content.style.color = theme.color;
        }
    }

    updatePaginationDisplay() {
        var pageInfo = document.getElementById('pageInfo');
        var pageInput = document.getElementById('pageInput');

        if (pageInfo) {
            if (this.isMobile) {
                pageInfo.textContent = this.currentPage + '/' + this.totalPages;
            } else {
                pageInfo.innerHTML = '第' + this.currentPage + '页 / 共' + this.totalPages + '页';
            }
        }
        if (pageInput) pageInput.value = this.currentPage;
    }

    updateProgress() {
        var progress = (this.currentPage / this.totalPages) * 100;
        var progressBar = document.getElementById('readingProgress');
        var progressText = document.getElementById('progressText');
        if (progressBar) {
            progressBar.style.width = progress + '%';
            if (!this.isMobile) progressBar.textContent = Math.round(progress) + '%';
        }
        if (progressText) {
            progressText.textContent = '阅读进度: ' + Math.round(progress) + '%';
        }
        this.readingProgress = progress;
    }

    savePosition() {
        if (this.settings.autoSave) {
            localStorage.setItem('bookmark_page_' + this.fileName, this.currentPage);
        }
    }

    loadBookmarks() {
        var bookmarks = localStorage.getItem('bookmarks_' + this.fileName);
        if (bookmarks) {
            try {
                this.showBookmarks(JSON.parse(bookmarks));
            } catch (e) { }
        }
    }

    addBookmark() {
        var bookmarks = localStorage.getItem('bookmarks_' + this.fileName);
        var marks = bookmarks ? JSON.parse(bookmarks) : [];

        var bookmark = {
            page: this.currentPage,
            time: new Date().toLocaleString(),
            note: prompt('添加书签备注（可选）：', '第' + this.currentPage + '页')
        };

        marks.push(bookmark);
        localStorage.setItem('bookmarks_' + this.fileName, JSON.stringify(marks));

        if (this.isMobile) {
            var toast = document.createElement('div');
            toast.className = 'position-fixed top-50 start-50 translate-middle bg-dark text-white p-3 rounded shadow';
            toast.style.zIndex = '2000';
            toast.innerHTML = '✅ 已添加书签：第' + bookmark.page + '页';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        } else {
            alert('书签已添加！第' + this.currentPage + '页');
        }

        this.showBookmarks(marks);
    }

    showBookmarks(marks) {
        console.log('书签列表:', marks);
    }

    changeFontSize(delta) {
        var minSize = this.isMobile ? 14 : 12;
        var maxSize = this.isMobile ? 48 : 36;
        this.settings.fontSize += delta;
        if (this.settings.fontSize < minSize) this.settings.fontSize = minSize;
        if (this.settings.fontSize > maxSize) this.settings.fontSize = maxSize;
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
            fontSize: this.isMobile ? 18 : 16,
            lineHeight: 1.8,
            fontFamily: 'Microsoft YaHei',
            theme: 'day',
            letterSpacing: 0,
            paragraphMargin: 10,
            pageWidth: this.isMobile ? '100%' : 800,
            showPageNumbers: true,
            autoSave: true
        };
        this.applyStyles();
        this.updateDisplays();
        this.saveSettings();
        alert('阅读设置已重置');
    }

    firstPage() {
        if (this.fileType === 'txt' && this.totalPages > 1) {
            this.currentPage = 1;
            this.renderTXTPage();
            window.scrollTo(0, 0);
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            if (this.fileType === 'txt') {
                this.renderTXTPage();
            }
            window.scrollTo(0, 0);
        } else if (this.isMobile && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(100);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            if (this.fileType === 'txt') {
                this.renderTXTPage();
            }
            window.scrollTo(0, 0);
        } else if (this.isMobile && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(100);
        }
    }

    lastPage() {
        if (this.fileType === 'txt') {
            this.currentPage = this.totalPages;
            this.renderTXTPage();
            window.scrollTo(0, 0);
        }
    }

    jumpToPage() {
        var pageInput = document.getElementById('pageInput');
        if (!pageInput) return;
        var page = parseInt(pageInput.value);
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            if (this.fileType === 'txt') {
                this.renderTXTPage();
            }
            window.scrollTo(0, 0);
        } else {
            alert('页码必须在1-' + this.totalPages + '之间');
        }
    }

    toggleFullscreen() {
        var elem = this.container;
        if (!document.fullscreenElement) {
            elem.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.bookReader === 'undefined') {
        window.bookReader = null;
    }
});
