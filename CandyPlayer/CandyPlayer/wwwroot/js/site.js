// CandyPlayer 全局JavaScript
$(document).ready(function () {
    // 侧边栏切换
    $("#menu-toggle").click(function (e) {
        e.preventDefault();
        $("#wrapper").toggleClass("toggled");
    });

    // 自动隐藏提示消息（5秒后淡出）
    setTimeout(function () {
        $('.alert').fadeOut('slow');
    }, 5000);

    // 为所有删除按钮添加确认提示
    $(document).on('click', '.delete-btn', function (e) {
        if (!confirm('确定要删除吗？此操作不可恢复！')) {
            e.preventDefault();
            return false;
        }
    });

    // 初始化工具提示
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // 页面加载时检查所有收藏按钮的状态
    $('.favorite-btn').each(function () {
        var $btn = $(this);
        var fileId = $btn.data('fileid');
        if (fileId) {
            checkFavoriteStatus(fileId, $btn);
        }
    });
});

// 全局函数

/**
 * 检查收藏状态
 * @param {number} fileId - 文件ID
 * @param {jQuery} btn - 按钮元素
 */
function checkFavoriteStatus(fileId, btn) {
    $.ajax({
        url: '/Favorite/Check',
        type: 'GET',
        data: { fileId: fileId },
        success: function (result) {
            if (result.isFavorited) {
                updateFavoriteButton(btn, true);
            } else {
                updateFavoriteButton(btn, false);
            }
        },
        error: function () {
            console.log('检查收藏状态失败');
        }
    });
}

/**
 * 更新收藏按钮样式
 * @param {jQuery} btn - 按钮元素
 * @param {boolean} isFavorited - 是否已收藏
 */
function updateFavoriteButton(btn, isFavorited) {
    if (isFavorited) {
        btn.html('<i class="fas fa-heart"></i> <span class="favorite-text">取消收藏</span>');
        btn.removeClass('btn-info').addClass('btn-danger');
    } else {
        btn.html('<i class="fas fa-heart"></i> <span class="favorite-text">收藏</span>');
        btn.removeClass('btn-danger').addClass('btn-info');
    }
    btn.data('favorited', isFavorited);
}

/**
 * 切换收藏状态
 * @param {number} fileId - 文件ID
 * @param {HTMLElement} btnElement - 按钮元素
 */
function toggleFavorite(fileId, btnElement) {
    var $btn = $(btnElement);
    var isFavorited = $btn.data('favorited');
    var token = $('input[name="__RequestVerificationToken"]').val();

    if (isFavorited) {
        // 取消收藏
        $.ajax({
            url: '/Favorite/Remove',
            type: 'POST',
            data: { fileId: fileId },
            headers: {
                'RequestVerificationToken': token
            },
            success: function (result) {
                if (result.success) {
                    updateFavoriteButton($btn, false);
                    showToast('已取消收藏', 'success');
                } else {
                    showToast(result.message || '操作失败', 'error');
                }
            },
            error: function (xhr) {
                var msg = xhr.responseJSON?.message || '操作失败，请稍后重试';
                showToast(msg, 'error');
            }
        });
    } else {
        // 添加收藏
        $.ajax({
            url: '/Favorite/Add',
            type: 'POST',
            data: { fileId: fileId },
            headers: {
                'RequestVerificationToken': token
            },
            success: function (result) {
                if (result.success) {
                    updateFavoriteButton($btn, true);
                    showToast('已添加到收藏', 'success');
                } else {
                    showToast(result.message || '操作失败', 'error');
                }
            },
            error: function (xhr) {
                var msg = xhr.responseJSON?.message || '操作失败，请稍后重试';
                showToast(msg, 'error');
            }
        });
    }
}

/**
 * 删除文件
 * @param {number} fileId - 文件ID
 * @param {string} url - 删除API地址（可选）
 */
function deleteFile(fileId, url) {
    if (confirm('确定要删除这个文件吗？此操作不可恢复！')) {
        var token = $('input[name="__RequestVerificationToken"]').val();
        $.ajax({
            url: url || '/Media/Delete',
            type: 'POST',
            data: { id: fileId },
            headers: {
                'RequestVerificationToken': token
            },
            success: function (result) {
                if (result.success) {
                    showToast('删除成功', 'success');
                    setTimeout(function () {
                        location.reload();
                    }, 1000);
                } else {
                    showToast(result.message || '删除失败', 'error');
                }
            },
            error: function () {
                showToast('删除失败，请稍后重试', 'error');
            }
        });
    }
}

/**
 * 添加到当前播放列表
 * @param {number} fileId - 音乐文件ID
 */
function addToPlaylist(fileId) {
    var token = $('input[name="__RequestVerificationToken"]').val();
    $.ajax({
        url: '/Playlist/AddToCurrentPlaylist',
        type: 'POST',
        data: { fileId: fileId },
        headers: {
            'RequestVerificationToken': token
        },
        success: function (result) {
            if (result.success) {
                showToast('已添加到当前播放列表', 'success');
            } else {
                showToast(result.message || '添加失败', 'error');
            }
        },
        error: function () {
            showToast('添加失败，请稍后重试', 'error');
        }
    });
}

/**
 * 刷新文件（管理员功能）
 */
function refreshFiles() {
    if (confirm('确定要刷新文件吗？这将扫描整个媒体文件夹并同步数据库。')) {
        var token = $('input[name="__RequestVerificationToken"]').val();
        $.ajax({
            url: '/Admin/RefreshFiles',
            type: 'POST',
            headers: {
                'RequestVerificationToken': token
            },
            success: function (result) {
                if (result.success) {
                    showToast('文件刷新成功', 'success');
                    setTimeout(function () {
                        location.reload();
                    }, 1000);
                } else {
                    showToast(result.message || '文件刷新失败', 'error');
                }
            },
            error: function () {
                showToast('文件刷新失败，请稍后重试', 'error');
            }
        });
    }
}

/**
 * 创建歌单
 * @param {number} type - 列表类型 (0=书籍,1=音乐,2=视频)
 * @param {string} callback - 回调函数名
 */
function createPlaylist(type, callback) {
    var name = prompt('请输入列表名称：');
    if (name && name.trim()) {
        var token = $('input[name="__RequestVerificationToken"]').val();
        $.ajax({
            url: '/Playlist/Create',
            type: 'POST',
            data: { name: name.trim(), description: '', type: type },
            headers: {
                'RequestVerificationToken': token
            },
            success: function (result) {
                if (result.success) {
                    showToast('列表创建成功', 'success');
                    if (callback && typeof window[callback] === 'function') {
                        window[callback](result.playlistId);
                    } else {
                        setTimeout(function () {
                            location.reload();
                        }, 1000);
                    }
                } else {
                    showToast(result.message || '创建失败', 'error');
                }
            },
            error: function () {
                showToast('创建失败，请稍后重试', 'error');
            }
        });
    }
}

/**
 * 添加到指定列表
 * @param {number} playlistId - 列表ID
 * @param {number} fileId - 文件ID
 * @param {string} note - 备注
 */
function addToPlaylistById(playlistId, fileId, note) {
    var token = $('input[name="__RequestVerificationToken"]').val();
    $.ajax({
        url: '/Playlist/AddItem',
        type: 'POST',
        data: { playlistId: playlistId, fileId: fileId, note: note || '' },
        headers: {
            'RequestVerificationToken': token
        },
        success: function (result) {
            if (result.success) {
                showToast('添加成功', 'success');
            } else {
                showToast(result.message || '添加失败', 'error');
            }
        },
        error: function () {
            showToast('添加失败，请稍后重试', 'error');
        }
    });
}

/**
 * 显示提示消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success/error/info/warning)
 */
function showToast(message, type) {
    // 检查是否有现成的toast容器
    var toastContainer = $('#toast-container');
    if (toastContainer.length === 0) {
        toastContainer = $('<div id="toast-container" style="position: fixed; top: 20px; right: 20px; z-index: 9999;"></div>');
        $('body').append(toastContainer);
    }

    var bgClass = '';
    var iconClass = '';
    switch (type) {
        case 'success':
            bgClass = 'bg-success';
            iconClass = 'fa-check-circle';
            break;
        case 'error':
            bgClass = 'bg-danger';
            iconClass = 'fa-exclamation-circle';
            break;
        case 'warning':
            bgClass = 'bg-warning';
            iconClass = 'fa-exclamation-triangle';
            break;
        default:
            bgClass = 'bg-info';
            iconClass = 'fa-info-circle';
    }

    var toastId = 'toast-' + Date.now();
    var toastHtml = '<div id="' + toastId + '" class="toast ' + bgClass + ' text-white" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="true" data-bs-delay="3000">' +
        '<div class="toast-header ' + bgClass + ' text-white">' +
        '<i class="fas ' + iconClass + ' me-2"></i>' +
        '<strong class="me-auto">提示</strong>' +
        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>' +
        '</div>' +
        '<div class="toast-body">' + message + '</div>' +
        '</div>';

    toastContainer.append(toastHtml);
    var toastElement = document.getElementById(toastId);
    var toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
    toast.show();

    // 自动移除DOM元素
    toastElement.addEventListener('hidden.bs.toast', function () {
        $(this).remove();
    });
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间 (mm:ss)
 */
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
}

/**
 * 获取URL参数
 * @param {string} name - 参数名
 * @returns {string|null} 参数值
 */
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

/**
 * 显示加载中状态
 * @param {string} elementId - 元素ID
 * @param {boolean} show - 是否显示
 */
function showLoading(elementId, show) {
    var loaderId = elementId + '-loader';
    if (show) {
        $('#' + elementId).hide();
        if ($('#' + loaderId).length === 0) {
            $('#' + elementId).after('<div id="' + loaderId + '" class="text-center py-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div></div>');
        }
    } else {
        $('#' + elementId).show();
        $('#' + loaderId).remove();
    }
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () {
        showToast('已复制到剪贴板', 'success');
    }).catch(function () {
        showToast('复制失败', 'error');
    });
}

/**
 * 确认对话框
 * @param {string} message - 确认消息
 * @param {function} callback - 确认后的回调函数
 */
function confirmDialog(message, callback) {
    if (confirm(message)) {
        if (callback && typeof callback === 'function') {
            callback();
        }
    }
}

/**
 * 播放上一首（音乐播放器用）
 */
function playPrevious() {
    if (window.player && window.playlist && window.currentIndex > 0) {
        window.currentIndex--;
        playSong(window.currentIndex);
    }
}

/**
 * 播放下一首（音乐播放器用）
 */
function playNext() {
    if (window.player && window.playlist && window.currentIndex < window.playlist.length - 1) {
        window.currentIndex++;
        playSong(window.currentIndex);
    }
}

/**
 * 播放指定歌曲（音乐播放器用）
 * @param {number} index - 歌曲索引
 */
function playSong(index) {
    if (window.playlist && window.playlist[index]) {
        var song = window.playlist[index];
        window.player.src = '/Media/Stream/' + song.fileId;
        window.player.play();
        $('#currentSongTitle').text(song.fileName);
        window.currentIndex = index;
    }
}

/**
 * 切换播放模式（音乐播放器用）
 * @param {string} mode - 播放模式 (order/loop/single/random)
 */
function setPlayMode(mode) {
    window.currentPlayMode = mode;
    localStorage.setItem('playMode', mode);
    var modeName = getPlayModeName(mode);
    showToast('播放模式已切换为：' + modeName, 'info');
}

/**
 * 获取播放模式名称
 * @param {string} mode - 播放模式
 * @returns {string} 模式名称
 */
function getPlayModeName(mode) {
    switch (mode) {
        case 'order': return '顺序播放';
        case 'loop': return '列表循环';
        case 'single': return '单曲循环';
        case 'random': return '随机播放';
        default: return '顺序播放';
    }
}

/**
 * 全屏切换
 * @param {HTMLElement} element - 要全屏的元素
 */
function toggleFullscreen(element) {
    if (!document.fullscreenElement) {
        element.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

/**
 * 处理键盘事件（阅读器用）
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleReaderKeyboard(e) {
    if (window.bookReader) {
        if (e.key === 'ArrowLeft') {
            window.bookReader.previousPage();
        } else if (e.key === 'ArrowRight') {
            window.bookReader.nextPage();
        }
    }
}

// 监听键盘事件
document.addEventListener('keydown', handleReaderKeyboard);