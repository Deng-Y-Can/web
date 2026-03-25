using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;

namespace CandyRepository.Controllers
{
    public class RecycleBinController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IFileService _fileService;
        private readonly IPermissionService _permissionService;
        private readonly ILogService _logService;
        private readonly IConfiguration _configuration;

        public RecycleBinController(
            ApplicationDbContext context,
            IFileService fileService,
            IPermissionService permissionService,
            ILogService logService,
            IConfiguration configuration)
        {
            _context = context;
            _fileService = fileService;
            _permissionService = permissionService;
            _logService = logService;
            _configuration = configuration;
        }

        private int GetCurrentUserId()
        {
            return HttpContext.Session.GetInt32("UserId") ?? 0;
        }

        private bool IsAdmin()
        {
            return HttpContext.Session.GetString("IsAdmin") == "True";
        }

        private string GetStorageRoot()
        {
            return _configuration["Storage:RootPath"] ?? @"E:\CandyRepository\";
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            var recycleItems = await _context.RecycleBin
                .Include(r => r.DeletedBy)
                .Where(r => IsAdmin() || r.DeletedByUserId == userId)
                .OrderByDescending(r => r.DeletedAt)
                .ToListAsync();

            ViewBag.RecycleItems = recycleItems;
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Restore(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var recycleItem = await _context.RecycleBin
                .FirstOrDefaultAsync(r => r.Id == id);

            if (recycleItem == null)
                return Json(new { success = false, message = "记录不存在" });

            if (!IsAdmin() && recycleItem.DeletedByUserId != userId)
                return Json(new { success = false, message = "无权限恢复" });

            if (recycleItem.ItemType == DeletedItemType.File)
            {
                var file = await _context.Files
                    .FirstOrDefaultAsync(f => f.Id == recycleItem.ItemId);

                if (file != null)
                {
                    // 检查原文件夹是否存在
                    var folder = await _context.Folders
                        .FirstOrDefaultAsync(f => f.Id == file.FolderId && !f.IsDeleted);

                    if (folder == null)
                        return Json(new { success = false, message = "原文件夹已被删除，无法恢复" });

                    // 恢复文件
                    file.IsDeleted = false;

                    // 恢复物理文件
                    var physicalPath = Path.Combine(GetStorageRoot(), file.PhysicalPath);
                    var recycleDir = Path.Combine(GetStorageRoot(), "Recycle", userId.ToString());
                    if (Directory.Exists(recycleDir))
                    {
                        var pattern = recycleItem.Name + "_*";
                        var recycledFiles = Directory.GetFiles(recycleDir, pattern);
                        if (recycledFiles.Length > 0)
                        {
                            var recycledFile = recycledFiles[0];
                            var targetDir = Path.GetDirectoryName(physicalPath);
                            if (!Directory.Exists(targetDir))
                            {
                                Directory.CreateDirectory(targetDir);
                            }
                            System.IO.File.Move(recycledFile, physicalPath);
                        }
                    }

                    _context.RecycleBin.Remove(recycleItem);
                    await _context.SaveChangesAsync();

                    await _logService.LogAsync(userId, OperationType.FileRestore,
                        $"恢复文件: {file.Name}",
                        $"原路径: {recycleItem.OriginalPath}");
                }
            }
            else if (recycleItem.ItemType == DeletedItemType.Folder)
            {
                var folder = await _context.Folders
                    .FirstOrDefaultAsync(f => f.Id == recycleItem.ItemId);

                if (folder != null)
                {
                    // 检查原父文件夹是否存在
                    if (folder.ParentFolderId.HasValue)
                    {
                        var parentFolder = await _context.Folders
                            .FirstOrDefaultAsync(f => f.Id == folder.ParentFolderId.Value && !f.IsDeleted);

                        if (parentFolder == null)
                            return Json(new { success = false, message = "原父文件夹已被删除，无法恢复" });
                    }

                    // 恢复文件夹及其所有子项
                    await RestoreFolderRecursiveAsync(folder);

                    _context.RecycleBin.Remove(recycleItem);
                    await _context.SaveChangesAsync();

                    await _logService.LogAsync(userId, OperationType.FolderCreate,
                        $"恢复文件夹: {folder.Name}",
                        $"路径: {folder.FullPath}");
                }
            }

            return Json(new { success = true, message = "恢复成功" });
        }

        private async Task RestoreFolderRecursiveAsync(Folder folder)
        {
            folder.IsDeleted = false;

            // 恢复物理文件夹
            var physicalPath = GetPhysicalPath(folder);
            var recycleDir = Path.Combine(GetStorageRoot(), "Recycle", folder.OwnerId.ToString());

            if (Directory.Exists(recycleDir))
            {
                var pattern = folder.Name + "_*";
                var recycledDirs = Directory.GetDirectories(recycleDir, pattern);
                if (recycledDirs.Length > 0)
                {
                    var recycledDirPath = recycledDirs[0];
                    var targetDir = Path.GetDirectoryName(physicalPath);
                    if (!Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }
                    Directory.Move(recycledDirPath, physicalPath);
                }
            }

            // 恢复子文件夹
            var subFolders = await _context.Folders
                .Where(f => f.ParentFolderId == folder.Id && f.IsDeleted)
                .ToListAsync();

            foreach (var subFolder in subFolders)
            {
                await RestoreFolderRecursiveAsync(subFolder);
            }

            // 恢复文件
            var files = await _context.Files
                .Where(f => f.FolderId == folder.Id && f.IsDeleted)
                .ToListAsync();

            foreach (var file in files)
            {
                file.IsDeleted = false;
            }
        }

        [HttpPost]
        public async Task<IActionResult> PermanentDelete(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var recycleItem = await _context.RecycleBin
                .FirstOrDefaultAsync(r => r.Id == id);

            if (recycleItem == null)
                return Json(new { success = false, message = "记录不存在" });

            if (!IsAdmin() && recycleItem.DeletedByUserId != userId)
                return Json(new { success = false, message = "无权限删除" });

            if (recycleItem.ItemType == DeletedItemType.File)
            {
                var file = await _context.Files
                    .FirstOrDefaultAsync(f => f.Id == recycleItem.ItemId);

                if (file != null)
                {
                    // 物理删除文件
                    var physicalPath = Path.Combine(GetStorageRoot(), file.PhysicalPath);
                    if (System.IO.File.Exists(physicalPath))
                    {
                        System.IO.File.Delete(physicalPath);
                    }

                    _context.Files.Remove(file);
                }
            }
            else if (recycleItem.ItemType == DeletedItemType.Folder)
            {
                var folder = await _context.Folders
                    .Include(f => f.SubFolders)
                    .Include(f => f.Files)
                    .FirstOrDefaultAsync(f => f.Id == recycleItem.ItemId);

                if (folder != null)
                {
                    await PermanentDeleteFolderRecursiveAsync(folder);
                }
            }

            _context.RecycleBin.Remove(recycleItem);
            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FileDelete,
                $"彻底删除: {recycleItem.Name}",
                $"类型: {recycleItem.ItemType}");

            return Json(new { success = true, message = "彻底删除成功" });
        }

        private async Task PermanentDeleteFolderRecursiveAsync(Folder folder)
        {
            // 递归删除子文件夹
            var subFolders = await _context.Folders
                .Where(f => f.ParentFolderId == folder.Id)
                .ToListAsync();

            foreach (var subFolder in subFolders)
            {
                await PermanentDeleteFolderRecursiveAsync(subFolder);
            }

            // 删除文件
            foreach (var file in folder.Files)
            {
                var filePhysicalPath = Path.Combine(GetStorageRoot(), file.PhysicalPath);
                if (System.IO.File.Exists(filePhysicalPath))
                {
                    System.IO.File.Delete(filePhysicalPath);
                }
                _context.Files.Remove(file);
            }

            // 删除物理文件夹
            var folderPhysicalPath = GetPhysicalPath(folder);
            if (Directory.Exists(folderPhysicalPath))
            {
                Directory.Delete(folderPhysicalPath, true);
            }

            _context.Folders.Remove(folder);
        }

        [HttpPost]
        public async Task<IActionResult> EmptyRecycleBin()
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var recycleItems = await _context.RecycleBin
                .Where(r => IsAdmin() || r.DeletedByUserId == userId)
                .ToListAsync();

            int deletedCount = 0;
            foreach (var item in recycleItems)
            {
                // 直接调用永久删除逻辑，不通过 PermanentDelete 方法避免重复查询
                if (item.ItemType == DeletedItemType.File)
                {
                    var file = await _context.Files
                        .FirstOrDefaultAsync(f => f.Id == item.ItemId);

                    if (file != null)
                    {
                        // 物理删除文件
                        var physicalPath = Path.Combine(GetStorageRoot(), file.PhysicalPath);
                        if (System.IO.File.Exists(physicalPath))
                        {
                            System.IO.File.Delete(physicalPath);
                        }
                        _context.Files.Remove(file);
                        deletedCount++;
                    }
                }
                else if (item.ItemType == DeletedItemType.Folder)
                {
                    var folder = await _context.Folders
                        .Include(f => f.SubFolders)
                        .Include(f => f.Files)
                        .FirstOrDefaultAsync(f => f.Id == item.ItemId);

                    if (folder != null)
                    {
                        await PermanentDeleteFolderRecursiveAsync(folder);
                        deletedCount++;
                    }
                }

                _context.RecycleBin.Remove(item);
            }

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FileDelete,
                $"清空回收站",
                $"共清理 {deletedCount} 个项目");

            return Json(new { success = true, message = $"已清空回收站，共清理 {deletedCount} 个项目" });
        }

        private string GetPhysicalPath(Folder folder)
        {
            var basePath = folder.Type == FolderType.Private ? "Private" : "Public";
            var ownerName = folder.Owner?.Username ?? "unknown";
            var folderPath = folder.FullPath ?? folder.Path ?? "";

            return Path.Combine(GetStorageRoot(), basePath, ownerName, folderPath);
        }
    }
}