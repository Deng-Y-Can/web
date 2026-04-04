using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CandyPlayer.Services;
using CandyPlayer.Models;
using CandyPlayer.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Formatters;
using MediaType = CandyPlayer.Models.MediaType;

namespace CandyPlayer.Controllers
{
    [Authorize]
    public class MediaController : Controller
    {
        private readonly MediaService _mediaService;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MediaController> _logger;
        private readonly IWebHostEnvironment _env;

        public MediaController(
            MediaService mediaService,
            ApplicationDbContext context,
            ILogger<MediaController> logger,
            IWebHostEnvironment env)
        {
            _mediaService = mediaService;
            _context = context;
            _logger = logger;
            _env = env;
        }

        // GET: /Media/Books
        [HttpGet]
        public async Task<IActionResult> Books(int page = 1, string search = "")
        {
            try
            {
                var pageSize = 20;
                var files = await _mediaService.GetFilesByTypeAsync(MediaType.Book, page, pageSize, search);
                var totalCount = await _mediaService.GetFilesCountByTypeAsync(MediaType.Book, search);

                ViewBag.CurrentPage = page;
                ViewBag.TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
                ViewBag.SearchKeyword = search;
                ViewBag.MediaType = "Books";

                return View(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "获取书籍列表失败");
                TempData["ErrorMessage"] = "获取书籍列表失败";
                return View(new List<MediaFile>());
            }
        }

        // GET: /Media/Music
        [HttpGet]
        public async Task<IActionResult> Music(int page = 1, string search = "")
        {
            try
            {
                var pageSize = 20;
                var files = await _mediaService.GetFilesByTypeAsync(MediaType.Music, page, pageSize, search);
                var totalCount = await _mediaService.GetFilesCountByTypeAsync(MediaType.Music, search);

                ViewBag.CurrentPage = page;
                ViewBag.TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
                ViewBag.SearchKeyword = search;
                ViewBag.MediaType = "Music";

                return View(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "获取音乐列表失败");
                TempData["ErrorMessage"] = "获取音乐列表失败";
                return View(new List<MediaFile>());
            }
        }

        // GET: /Media/Videos
        [HttpGet]
        public async Task<IActionResult> Videos(int page = 1, string search = "")
        {
            try
            {
                var pageSize = 20;
                var files = await _mediaService.GetFilesByTypeAsync(MediaType.Video, page, pageSize, search);
                var totalCount = await _mediaService.GetFilesCountByTypeAsync(MediaType.Video, search);

                ViewBag.CurrentPage = page;
                ViewBag.TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
                ViewBag.SearchKeyword = search;
                ViewBag.MediaType = "Videos";

                return View(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "获取视频列表失败");
                TempData["ErrorMessage"] = "获取视频列表失败";
                return View(new List<MediaFile>());
            }
        }

        // POST: /Media/Upload (通用上传方法)
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RequestSizeLimit(1073741824)] // 1GB
        [RequestFormLimits(MultipartBodyLengthLimit = 1073741824)]
        public async Task<IActionResult> Upload(List<IFormFile> files, int mediaType)
        {
            try
            {
                _logger.LogInformation($"开始处理上传请求，文件数量: {files?.Count ?? 0}, 类型: {(MediaType)mediaType}");

                // 验证用户权限
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("用户未登录");
                    return Json(new { success = false, message = "请先登录" });
                }

                var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? HttpContext.Session.GetString("UserRole");
                if (userRole != "Admin" && userRole != "AdvancedUser")
                {
                    _logger.LogWarning($"用户 {userId} 没有上传权限，角色: {userRole}");
                    return Json(new { success = false, message = "您没有上传权限，只有管理员和高级用户可以上传" });
                }

                if (files == null || files.Count == 0)
                {
                    _logger.LogWarning("没有选择文件");
                    return Json(new { success = false, message = "请选择文件" });
                }

                var mediaTypeEnum = (MediaType)mediaType;
                var savePath = mediaTypeEnum switch
                {
                    MediaType.Book => _mediaService.GetBooksPath(),
                    MediaType.Music => _mediaService.GetMusicPath(),
                    MediaType.Video => _mediaService.GetVideosPath(),
                    _ => _mediaService.GetMediaPath()
                };

                // 确保目录存在
                if (!Directory.Exists(savePath))
                {
                    Directory.CreateDirectory(savePath);
                    _logger.LogInformation($"创建目录: {savePath}");
                }

                var uploadedFiles = new List<string>();
                var failedFiles = new List<string>();
                var maxSize = 1024 * 1024 * 1024; // 1GB

                foreach (var file in files)
                {
                    try
                    {
                        _logger.LogInformation($"处理文件: {file.FileName}, 大小: {file.Length} bytes ({file.Length / 1024 / 1024} MB)");

                        // 验证文件
                        if (file == null || file.Length == 0)
                        {
                            failedFiles.Add($"{file?.FileName} - 文件为空");
                            continue;
                        }

                        // 检查文件大小
                        if (file.Length > maxSize)
                        {
                            failedFiles.Add($"{file.FileName} - 文件大小超过1GB限制");
                            continue;
                        }

                        // 验证文件类型
                        var extension = Path.GetExtension(file.FileName).ToLower();
                        bool isValidType = mediaTypeEnum switch
                        {
                            MediaType.Book => extension == ".pdf" || extension == ".txt",
                            MediaType.Music => extension == ".mp3" || extension == ".wav" || extension == ".flac" || extension == ".m4a" || extension == ".ogg",
                            MediaType.Video => extension == ".mp4" || extension == ".avi" || extension == ".mkv" || extension == ".mov" || extension == ".webm" || extension == ".flv" || extension == ".wmv" || extension == ".m4v",
                            _ => false
                        };

                        if (!isValidType)
                        {
                            failedFiles.Add($"{file.FileName} - 不支持的文件类型: {extension}");
                            continue;
                        }

                        // 生成唯一文件名
                        var fileNameWithoutExt = Path.GetFileNameWithoutExtension(file.FileName);
                        var fileName = file.FileName;
                        var filePath = Path.Combine(savePath, fileName);

                        // 如果文件已存在，添加时间戳
                        if (System.IO.File.Exists(filePath))
                        {
                            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                            fileName = $"{fileNameWithoutExt}_{timestamp}{extension}";
                            filePath = Path.Combine(savePath, fileName);
                        }

                        // 保存文件 - 使用更大的缓冲区
                        using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
                        {
                            await file.CopyToAsync(stream);
                            await stream.FlushAsync();
                        }

                        // 验证文件是否保存成功
                        if (!System.IO.File.Exists(filePath))
                        {
                            failedFiles.Add($"{file.FileName} - 文件保存失败");
                            continue;
                        }

                        // 获取文件信息
                        var fileInfo = new FileInfo(filePath);
                        long actualFileSize = fileInfo.Length;

                        _logger.LogInformation($"文件保存成功: {filePath}, 大小: {actualFileSize} bytes ({actualFileSize / 1024 / 1024} MB)");

                        var mediaFile = new MediaFile
                        {
                            FileName = fileName,
                            FilePath = filePath,
                            MediaType = mediaTypeEnum,
                            FileExtension = extension.TrimStart('.'),
                            FileSize = actualFileSize,
                            LastModifiedTime = fileInfo.LastWriteTime,
                            AddedTime = DateTime.Now,
                            PlayCount = 0,
                            DownloadCount = 0
                        };

                        _context.MediaFiles.Add(mediaFile);
                        uploadedFiles.Add(file.FileName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"上传文件失败: {file?.FileName}");
                        failedFiles.Add($"{file?.FileName} - {ex.Message}");
                    }
                }

                await _context.SaveChangesAsync();

                // 记录操作日志
                if (uploadedFiles.Any())
                {
                    var username = User.Identity?.Name ?? HttpContext.Session.GetString("Username") ?? "未知";
                    var operationLog = new OperationLog
                    {
                        UserId = int.Parse(userId),
                        Username = username,
                        OperationType = OperationType.Upload,
                        OperationContent = $"上传文件: {string.Join(", ", uploadedFiles)} 到 {mediaTypeEnum} 目录",
                        OperationTime = DateTime.Now,
                        IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                    };
                    _context.OperationLogs.Add(operationLog);
                    await _context.SaveChangesAsync();
                }

                var message = $"成功上传 {uploadedFiles.Count} 个文件";
                if (failedFiles.Any())
                {
                    message += $"，失败 {failedFiles.Count} 个：{string.Join("；", failedFiles)}";
                }

                _logger.LogInformation(message);
                return Json(new { success = true, message = message, uploadedCount = uploadedFiles.Count, failedCount = failedFiles.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "上传文件失败");
                return Json(new { success = false, message = $"上传失败: {ex.Message}" });
            }
        }

        // POST: /Media/UploadVideo (专门处理视频上传)
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RequestSizeLimit(1073741824)] // 1GB
        [RequestFormLimits(MultipartBodyLengthLimit = 1073741824)]
        public async Task<IActionResult> UploadVideo(List<IFormFile> files)
        {
            try
            {
                _logger.LogInformation($"开始处理视频上传请求，文件数量: {files?.Count ?? 0}");

                // 验证用户权限
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("用户未登录");
                    return Json(new { success = false, message = "请先登录" });
                }

                var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? HttpContext.Session.GetString("UserRole");
                if (userRole != "Admin" && userRole != "AdvancedUser")
                {
                    _logger.LogWarning($"用户 {userId} 没有上传权限，角色: {userRole}");
                    return Json(new { success = false, message = "您没有上传权限，只有管理员和高级用户可以上传" });
                }

                if (files == null || files.Count == 0)
                {
                    _logger.LogWarning("没有选择文件");
                    return Json(new { success = false, message = "请选择文件" });
                }

                // 获取保存路径
                var savePath = _mediaService.GetVideosPath();
                if (!Directory.Exists(savePath))
                {
                    Directory.CreateDirectory(savePath);
                    _logger.LogInformation($"创建视频目录: {savePath}");
                }

                var uploadedFiles = new List<string>();
                var failedFiles = new List<string>();
                var maxSize = 1024 * 1024 * 1024; // 1GB

                // 支持的视频格式
                var validExtensions = new[] { ".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".wmv", ".m4v" };

                foreach (var file in files)
                {
                    try
                    {
                        _logger.LogInformation($"处理视频文件: {file.FileName}, 大小: {file.Length} bytes ({file.Length / 1024 / 1024} MB)");

                        // 验证文件
                        if (file == null || file.Length == 0)
                        {
                            failedFiles.Add($"{file?.FileName} - 文件为空");
                            continue;
                        }

                        // 检查文件大小
                        if (file.Length > maxSize)
                        {
                            failedFiles.Add($"{file.FileName} - 文件大小超过1GB限制");
                            continue;
                        }

                        // 验证文件类型
                        var extension = Path.GetExtension(file.FileName).ToLower();
                        if (!validExtensions.Contains(extension))
                        {
                            failedFiles.Add($"{file.FileName} - 不支持的文件类型: {extension}");
                            continue;
                        }

                        // 生成唯一文件名
                        var fileNameWithoutExt = Path.GetFileNameWithoutExtension(file.FileName);
                        var fileName = file.FileName;
                        var filePath = Path.Combine(savePath, fileName);

                        // 如果文件已存在，添加时间戳
                        if (System.IO.File.Exists(filePath))
                        {
                            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                            fileName = $"{fileNameWithoutExt}_{timestamp}{extension}";
                            filePath = Path.Combine(savePath, fileName);
                        }

                        // 保存文件
                        using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
                        {
                            await file.CopyToAsync(stream);
                            await stream.FlushAsync();
                        }

                        // 验证文件是否保存成功
                        if (!System.IO.File.Exists(filePath))
                        {
                            failedFiles.Add($"{file.FileName} - 文件保存失败");
                            continue;
                        }

                        // 获取文件信息
                        var fileInfo = new FileInfo(filePath);
                        long actualFileSize = fileInfo.Length;

                        _logger.LogInformation($"视频文件保存成功: {filePath}, 大小: {actualFileSize} bytes ({actualFileSize / 1024 / 1024} MB)");

                        var mediaFile = new MediaFile
                        {
                            FileName = fileName,
                            FilePath = filePath,
                            MediaType = MediaType.Video,
                            FileExtension = extension.TrimStart('.'),
                            FileSize = actualFileSize,
                            LastModifiedTime = fileInfo.LastWriteTime,
                            AddedTime = DateTime.Now,
                            PlayCount = 0,
                            DownloadCount = 0
                        };

                        _context.MediaFiles.Add(mediaFile);
                        uploadedFiles.Add(file.FileName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"上传视频失败: {file?.FileName}");
                        failedFiles.Add($"{file?.FileName} - {ex.Message}");
                    }
                }

                await _context.SaveChangesAsync();

                // 记录操作日志
                if (uploadedFiles.Any())
                {
                    var username = User.Identity?.Name ?? HttpContext.Session.GetString("Username") ?? "未知";
                    var operationLog = new OperationLog
                    {
                        UserId = int.Parse(userId),
                        Username = username,
                        OperationType = OperationType.Upload,
                        OperationContent = $"上传视频: {string.Join(", ", uploadedFiles)}",
                        OperationTime = DateTime.Now,
                        IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                    };
                    _context.OperationLogs.Add(operationLog);
                    await _context.SaveChangesAsync();
                }

                var message = $"成功上传 {uploadedFiles.Count} 个视频文件";
                if (failedFiles.Any())
                {
                    message += $"，失败 {failedFiles.Count} 个：{string.Join("；", failedFiles)}";
                }

                _logger.LogInformation(message);
                return Json(new { success = true, message = message, uploadedCount = uploadedFiles.Count, failedCount = failedFiles.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "上传视频失败");
                return Json(new { success = false, message = $"上传失败: {ex.Message}" });
            }
        }

        // GET: /Media/Play/{id}
        [HttpGet]
        public async Task<IActionResult> Play(int id)
        {
            try
            {
                var file = await _context.MediaFiles.FindAsync(id);
                if (file == null)
                {
                    return NotFound();
                }

                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (!string.IsNullOrEmpty(userId))
                {
                    // 记录播放次数
                    file.PlayCount++;

                    // 记录播放历史
                    var history = new PlayHistory
                    {
                        UserId = int.Parse(userId),
                        MediaFileId = id,
                        PlayTime = DateTime.Now
                    };
                    _context.PlayHistories.Add(history);
                    await _context.SaveChangesAsync();
                }

                // 根据文件类型返回对应的视图
                switch (file.MediaType)
                {
                    case MediaType.Music:
                        return View("MusicPlayer", file);
                    case MediaType.Video:
                        return View("VideoPlayer", file);
                    case MediaType.Book:
                        return View("BookReader", file);
                    default:
                        return NotFound();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"播放文件失败: {id}");
                TempData["ErrorMessage"] = "播放文件失败";
                return RedirectToAction("Index", "Home");
            }
        }

        // GET: /Media/Stream/{id}
        [HttpGet]
        public async Task<IActionResult> Stream(int id)
        {
            try
            {
                var file = await _context.MediaFiles.FindAsync(id);
                if (file == null || !System.IO.File.Exists(file.FilePath))
                {
                    return NotFound();
                }

                var fileInfo = new FileInfo(file.FilePath);
                var fileStream = System.IO.File.OpenRead(file.FilePath);
                var contentType = _mediaService.GetContentType(file.FileExtension);

                // 处理Range请求（支持视频拖动）
                if (Request.Headers.ContainsKey("Range"))
                {
                    var range = Request.Headers["Range"].ToString();
                    var rangeValue = range.Replace("bytes=", "").Split('-');
                    var start = long.Parse(rangeValue[0]);
                    var end = rangeValue.Length > 1 && !string.IsNullOrEmpty(rangeValue[1])
                        ? long.Parse(rangeValue[1])
                        : fileInfo.Length - 1;

                    var contentLength = end - start + 1;
                    fileStream.Seek(start, SeekOrigin.Begin);

                    Response.Headers.Add("Content-Range", $"bytes {start}-{end}/{fileInfo.Length}");
                    Response.Headers.Add("Accept-Ranges", "bytes");
                    Response.StatusCode = 206;

                    return File(fileStream, contentType, file.FileName, true);
                }

                return File(fileStream, contentType, file.FileName, true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"流式传输文件失败: {id}");
                return NotFound();
            }
        }

        // GET: /Media/Download/{id}
        [HttpGet]
        public async Task<IActionResult> Download(int id)
        {
            try
            {
                var file = await _context.MediaFiles.FindAsync(id);
                if (file == null || !System.IO.File.Exists(file.FilePath))
                {
                    return NotFound();
                }

                // 记录下载次数
                file.DownloadCount++;
                await _context.SaveChangesAsync();

                var bytes = await System.IO.File.ReadAllBytesAsync(file.FilePath);
                return File(bytes, "application/octet-stream", file.FileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"下载文件失败: {id}");
                return NotFound();
            }
        }

        // POST: /Media/Delete/{id}
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? HttpContext.Session.GetString("UserRole");

                if (string.IsNullOrEmpty(userId) || userRole != "Admin")
                {
                    return Json(new { success = false, message = "无权限删除，只有管理员可以删除文件" });
                }

                var file = await _context.MediaFiles.FindAsync(id);
                if (file == null)
                {
                    return Json(new { success = false, message = "文件不存在" });
                }

                // 删除硬盘文件
                if (System.IO.File.Exists(file.FilePath))
                {
                    System.IO.File.Delete(file.FilePath);
                    _logger.LogInformation($"删除文件: {file.FilePath}");
                }

                // 删除数据库记录
                _context.MediaFiles.Remove(file);
                await _context.SaveChangesAsync();

                // 记录操作日志
                var username = User.Identity?.Name ?? HttpContext.Session.GetString("Username") ?? "未知";
                var operationLog = new OperationLog
                {
                    UserId = int.Parse(userId),
                    Username = username,
                    OperationType = OperationType.Delete,
                    OperationContent = $"删除文件: {file.FileName}",
                    OperationTime = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                };
                _context.OperationLogs.Add(operationLog);
                await _context.SaveChangesAsync();

                return Json(new { success = true, message = "删除成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"删除文件失败: {id}");
                return Json(new { success = false, message = $"删除失败: {ex.Message}" });
            }
        }

        // POST: /Media/SavePlaybackProgress
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SavePlaybackProgress([FromBody] PlaybackProgressModel model)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false });
                }

                var userIdInt = int.Parse(userId);
                var history = await _context.PlayHistories
                    .FirstOrDefaultAsync(h => h.UserId == userIdInt && h.MediaFileId == model.FileId);

                if (history == null)
                {
                    history = new PlayHistory
                    {
                        UserId = userIdInt,
                        MediaFileId = model.FileId,
                        PlayTime = DateTime.Now,
                        PlayPosition = (long)model.Position,
                        PlayProgress = (int)(model.Progress * 100)
                    };
                    _context.PlayHistories.Add(history);
                }
                else
                {
                    history.PlayPosition = (long)model.Position;
                    history.PlayProgress = (int)(model.Progress * 100);
                    history.PlayTime = DateTime.Now;
                }

                await _context.SaveChangesAsync();
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "保存播放进度失败");
                return Json(new { success = false });
            }
        }

        // GET: /Media/GetPlaybackProgress/{id}
        [HttpGet]
        public async Task<IActionResult> GetPlaybackProgress(int id)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { progress = 0 });
                }

                var history = await _context.PlayHistories
                    .FirstOrDefaultAsync(h => h.UserId == int.Parse(userId) && h.MediaFileId == id);

                if (history?.PlayProgress != null)
                {
                    return Json(new { progress = history.PlayProgress.Value / 100.0 });
                }

                return Json(new { progress = 0 });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "获取播放进度失败");
                return Json(new { progress = 0 });
            }
        }


        // GET: /Media/GetAvailableFiles
        [HttpGet]
        public async Task<IActionResult> GetAvailableFiles(int type, int? excludePlaylistId = null)
        {
            try
            {
                var mediaType = (MediaType)type;

                var query = _context.MediaFiles
                    .Where(f => f.MediaType == mediaType)
                    .Select(f => new
                    {
                        f.FileId,
                        f.FileName,
                        f.FileSize
                    });

                if (excludePlaylistId.HasValue)
                {
                    var existingFileIds = await _context.PlaylistItems
                        .Where(pi => pi.PlaylistId == excludePlaylistId.Value)
                        .Select(pi => pi.MediaFileId)
                        .ToListAsync();

                    query = query.Where(f => !existingFileIds.Contains(f.FileId));
                }

                var files = await query
                    .OrderBy(f => f.FileName)
                    .ToListAsync();

                return Json(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "获取可用文件失败");
                return Json(new List<object>());
            }
        }
    }

    // 播放进度模型
    public class PlaybackProgressModel
    {
        public int FileId { get; set; }
        public double Position { get; set; }
        public double Progress { get; set; }
    }
}