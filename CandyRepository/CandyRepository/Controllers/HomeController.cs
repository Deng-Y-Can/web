using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;

namespace CandyRepository.Controllers
{
    public class HomeController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IFileService _fileService;
        private readonly IPermissionService _permissionService;
        private readonly ILogService _logService;

        public HomeController(
            ApplicationDbContext context,
            IFileService fileService,
            IPermissionService permissionService,
            ILogService logService)
        {
            _context = context;
            _fileService = fileService;
            _permissionService = permissionService;
            _logService = logService;
        }

        private int GetCurrentUserId()
        {
            return HttpContext.Session.GetInt32("UserId") ?? 0;
        }

        private bool IsAdmin()
        {
            return HttpContext.Session.GetString("IsAdmin") == "True";
        }

        public async Task<IActionResult> Index()
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            var user = await _context.Users.FindAsync(userId);

            // 获取最近访问的文件夹
            var recentFolders = await _context.Folders
                .Include(f => f.Owner)
                .Where(f => f.OwnerId == userId && !f.IsDeleted)
                .OrderByDescending(f => f.ModifiedAt)
                .Take(5)
                .ToListAsync();

            // 获取最近上传的文件
            var recentFiles = await _context.Files
                .Include(f => f.Folder)
                .Where(f => f.UploadedById == userId && !f.IsDeleted)
                .OrderByDescending(f => f.UploadedAt)
                .Take(10)
                .ToListAsync();

            // 获取统计信息
            var totalSize = await _context.Files
                .Where(f => f.UploadedById == userId && !f.IsDeleted)
                .SumAsync(f => f.Size);

            var recentActivities = await _logService.GetUserLogsAsync(userId, DateTime.UtcNow.AddDays(-7));

            ViewBag.User = user;
            ViewBag.RecentFolders = recentFolders;
            ViewBag.RecentFiles = recentFiles;
            ViewBag.TotalFiles = await _context.Files.CountAsync(f => f.UploadedById == userId && !f.IsDeleted);
            ViewBag.TotalFolders = await _context.Folders.CountAsync(f => f.OwnerId == userId && !f.IsDeleted);
            ViewBag.TotalSize = FormatFileSize(totalSize);
            ViewBag.RecentActivities = recentActivities;
            ViewBag.IsAdmin = IsAdmin();

            return View();
        }

        [HttpGet]
        public async Task<IActionResult> Search(string keyword, string? fileType, DateTime? startDate, DateTime? endDate, long? minSize, long? maxSize)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            List<Models.File> results = new List<Models.File>();

            if (!string.IsNullOrWhiteSpace(keyword) || !string.IsNullOrEmpty(fileType) || startDate.HasValue || endDate.HasValue || minSize.HasValue || maxSize.HasValue)
            {
                var accessibleFolders = await _permissionService.GetAccessibleFoldersAsync(userId, PermissionType.ViewOnly);
                var folderIds = accessibleFolders.Select(f => f.Id).ToList();

                var query = _context.Files
                    .Include(f => f.Folder)
                    .ThenInclude(f => f!.Owner)
                    .Include(f => f.UploadedBy)
                    .Where(f => folderIds.Contains(f.FolderId) && !f.IsDeleted);

                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    query = query.Where(f => f.Name.Contains(keyword));
                }

                if (!string.IsNullOrEmpty(fileType))
                {
                    if (fileType == "image")
                        query = query.Where(f => f.ContentType != null && f.ContentType.StartsWith("image/"));
                    else
                        query = query.Where(f => f.ContentType != null && f.ContentType.Contains(fileType));
                }

                if (startDate.HasValue)
                {
                    query = query.Where(f => f.UploadedAt >= startDate.Value);
                }

                if (endDate.HasValue)
                {
                    var endOfDay = endDate.Value.AddDays(1);
                    query = query.Where(f => f.UploadedAt <= endOfDay);
                }

                if (minSize.HasValue)
                {
                    query = query.Where(f => f.Size >= minSize.Value * 1024);
                }

                if (maxSize.HasValue)
                {
                    query = query.Where(f => f.Size <= maxSize.Value * 1024);
                }

                results = await query
                    .OrderByDescending(f => f.UploadedAt)
                    .Take(200)
                    .ToListAsync();
            }

            ViewBag.Results = results;
            ViewBag.Keyword = keyword;
            ViewBag.FileType = fileType;
            ViewBag.StartDate = startDate;
            ViewBag.EndDate = endDate;
            ViewBag.MinSize = minSize.HasValue ? minSize.Value * 1024 : (long?)null;
            ViewBag.MaxSize = maxSize.HasValue ? maxSize.Value * 1024 : (long?)null;

            return View();
        }

        [HttpGet]
        public async Task<IActionResult> GetFolderTree(int? parentId = null)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new List<object>());

            var folders = await _context.Folders
                .Include(f => f.Owner)
                .Where(f => f.ParentFolderId == parentId && !f.IsDeleted)
                .ToListAsync();

            var accessibleFolders = new List<Folder>();
            foreach (var folder in folders)
            {
                if (folder.Type == FolderType.Private && folder.OwnerId != userId)
                    continue;

                var permission = await _permissionService.GetUserFolderPermissionAsync(folder.Id, userId);
                if (permission >= PermissionType.ViewOnly)
                {
                    accessibleFolders.Add(folder);
                }
            }

            var tree = new List<object>();
            foreach (var folder in accessibleFolders)
            {
                var hasChildren = await _context.Folders
                    .AnyAsync(f => f.ParentFolderId == folder.Id && !f.IsDeleted);

                tree.Add(new
                {
                    id = folder.Id,
                    name = folder.Name,
                    type = folder.Type.ToString(),
                    hasChildren = hasChildren,
                    owner = folder.Owner?.Username
                });
            }

            return Json(tree);
        }

        [HttpGet]
        public async Task<IActionResult> GetFolderInfo(int folderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var folder = await _context.Folders
                .Include(f => f.Owner)
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return Json(new { success = false, message = "文件夹不存在" });

            var hasPermission = await _permissionService.CheckPermissionAsync(folderId, userId, PermissionType.ViewOnly, true);
            if (!hasPermission)
                return Json(new { success = false, message = "无权限访问" });

            // 计算文件夹大小
            var folderSize = await CalculateFolderSizeAsync(folderId);

            // 获取子文件夹数量
            var subFolderCount = await _context.Folders
                .CountAsync(f => f.ParentFolderId == folderId && !f.IsDeleted);

            // 获取文件数量
            var fileCount = await _context.Files
                .CountAsync(f => f.FolderId == folderId && !f.IsDeleted);

            return Json(new
            {
                success = true,
                folder = new
                {
                    folder.Id,
                    folder.Name,
                    folder.Type,
                    folder.CreatedAt,
                    folder.ModifiedAt,
                    Owner = folder.Owner?.Username,
                    Size = FormatFileSize(folderSize),
                    SubFolderCount = subFolderCount,
                    FileCount = fileCount
                }
            });
        }

        private async Task<long> CalculateFolderSizeAsync(int folderId)
        {
            var files = await _context.Files
                .Where(f => f.FolderId == folderId && !f.IsDeleted)
                .SumAsync(f => f.Size);

            var subFolders = await _context.Folders
                .Where(f => f.ParentFolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var subFolder in subFolders)
            {
                files += await CalculateFolderSizeAsync(subFolder.Id);
            }

            return files;
        }

        private string FormatFileSize(long bytes)
        {
            string[] sizes = { "B", "KB", "MB", "GB", "TB" };
            double len = bytes;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len = len / 1024;
            }
            return $"{len:0.##} {sizes[order]}";
        }
    }
}