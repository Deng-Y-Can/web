using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;

namespace CandyRepository.Controllers
{
    public class FolderController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IPermissionService _permissionService;
        private readonly IFileService _fileService;
        private readonly ILogService _logService;
        private readonly string _storageRoot;

        public FolderController(
            ApplicationDbContext context,
            IPermissionService permissionService,
            IFileService fileService,
            ILogService logService,
            IConfiguration configuration)
        {
            _context = context;
            _permissionService = permissionService;
            _fileService = fileService;
            _logService = logService;
            _storageRoot = configuration["Storage:RootPath"] ?? @"E:\CandyRepository\";
        }

        private int GetCurrentUserId()
        {
            return HttpContext.Session.GetInt32("UserId") ?? 0;
        }

        private bool IsAdmin()
        {
            return HttpContext.Session.GetString("IsAdmin") == "True";
        }

        [HttpGet]
        public async Task<IActionResult> Index(int? folderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            Folder? currentFolder = null;
            if (folderId.HasValue && folderId.Value > 0)
            {
                currentFolder = await _context.Folders
                    .Include(f => f.Owner)
                    .FirstOrDefaultAsync(f => f.Id == folderId.Value && !f.IsDeleted);

                if (currentFolder == null)
                    return NotFound();

                var hasPermission = await _permissionService.CheckPermissionAsync(currentFolder.Id, userId, PermissionType.ViewOnly, true);
                if (!hasPermission)
                    return Forbid();
            }

            var folders = await _context.Folders
                .Include(f => f.Owner)
                .Where(f => f.ParentFolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            // 过滤有权限的文件夹
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

            var files = await _context.Files
                .Include(f => f.UploadedBy)
                .Where(f => f.FolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            // 过滤有权限的文件
            var accessibleFiles = new List<Models.File>();
            foreach (var file in files)
            {
                var permission = await _permissionService.GetUserFilePermissionAsync(file.Id, userId);
                if (permission >= PermissionType.ViewOnly)
                {
                    accessibleFiles.Add(file);
                }
            }

            ViewBag.CurrentFolder = currentFolder;
            ViewBag.Folders = accessibleFolders;
            ViewBag.Files = accessibleFiles;
            ViewBag.UserId = userId;
            ViewBag.IsAdmin = IsAdmin();

            // 面包屑导航
            var breadcrumbs = new List<Folder>();
            var temp = currentFolder;
            while (temp != null)
            {
                breadcrumbs.Insert(0, temp);
                temp = await _context.Folders.FindAsync(temp.ParentFolderId);
            }
            ViewBag.Breadcrumbs = breadcrumbs;

            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Create(string name, FolderType type, int? parentFolderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            // 检查父文件夹权限（如果有）
            if (parentFolderId.HasValue)
            {
                var parentFolder = await _context.Folders.FindAsync(parentFolderId.Value);
                if (parentFolder == null)
                    return Json(new { success = false, message = "父文件夹不存在" });

                var hasPermission = await _permissionService.CheckPermissionAsync(parentFolder.Id, userId, PermissionType.CanEdit, true);
                if (!hasPermission)
                    return Json(new { success = false, message = "没有在父文件夹中创建的权限" });
            }

            // 检查文件夹层级深度
            var depth = await GetFolderDepth(parentFolderId);
            var maxDepth = 10;
            if (depth >= maxDepth)
                return Json(new { success = false, message = $"文件夹层级不能超过 {maxDepth} 级" });

            // 检查重名
            var existingFolder = await _context.Folders
                .FirstOrDefaultAsync(f => f.ParentFolderId == parentFolderId && f.Name == name && !f.IsDeleted);

            if (existingFolder != null)
                return Json(new { success = false, message = "同名文件夹已存在" });

            var userName = HttpContext.Session.GetString("Username") ?? "unknown";

            var folder = new Folder
            {
                Name = name,
                Type = type,
                ParentFolderId = parentFolderId,
                OwnerId = userId,
                CreatedAt = DateTime.UtcNow
            };

            // 构建路径
            var path = await BuildFolderPath(parentFolderId, name);
            folder.Path = path;
            folder.FullPath = path;

            _context.Folders.Add(folder);
            await _context.SaveChangesAsync();

            // 创建物理目录
            var physicalPath = GetPhysicalPath(folder);
            if (!Directory.Exists(physicalPath))
            {
                Directory.CreateDirectory(physicalPath);
            }

            // 如果是公开文件夹，添加所有者权限记录
            if (type == FolderType.Public)
            {
                var ownerPermission = new FolderPermission
                {
                    FolderId = folder.Id,
                    UserId = userId,
                    Permission = PermissionType.FullControl,
                    GrantedAt = DateTime.UtcNow,
                    GrantedById = userId
                };
                _context.FolderPermissions.Add(ownerPermission);
                await _context.SaveChangesAsync();
            }

            await _logService.LogAsync(userId, OperationType.FolderCreate,
                $"创建文件夹: {name}",
                $"类型: {type}, 路径: {path}");

            return Json(new { success = true, message = "创建成功", folderId = folder.Id });
        }

        [HttpPost]
        public async Task<IActionResult> Delete(int folderId, bool confirm = false)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var folder = await _context.Folders
                .Include(f => f.SubFolders)
                .Include(f => f.Files)
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return Json(new { success = false, message = "文件夹不存在" });

            var hasPermission = await _permissionService.CheckPermissionAsync(folderId, userId, PermissionType.FullControl, true);
            if (!hasPermission)
                return Json(new { success = false, message = "没有删除权限" });

            // 检查是否有子项
            var hasChildren = folder.SubFolders.Any(f => !f.IsDeleted) || folder.Files.Any(f => !f.IsDeleted);
            if (hasChildren && !confirm)
            {
                var childCount = folder.SubFolders.Count(f => !f.IsDeleted) + folder.Files.Count(f => !f.IsDeleted);
                return Json(new { success = false, needConfirm = true, message = $"文件夹不为空，包含 {childCount} 个子项，是否确认删除？" });
            }

            // 软删除 - 移动到回收站
            folder.IsDeleted = true;

            // 记录到回收站
            var recycleItem = new RecycleBin
            {
                ItemType = DeletedItemType.Folder,
                ItemId = folder.Id,
                OriginalPath = folder.FullPath ?? folder.Path ?? "",
                Name = folder.Name,
                DeletedByUserId = userId,
                DeletedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(30)
            };
            _context.RecycleBin.Add(recycleItem);

            // 移动物理文件夹到回收站
            var physicalPath = GetPhysicalPath(folder);
            var recyclePath = Path.Combine(_storageRoot, "Recycle", userId.ToString(), folder.Name + "_" + DateTime.UtcNow.Ticks);
            if (Directory.Exists(physicalPath))
            {
                var recycleDir = Path.GetDirectoryName(recyclePath);
                if (!Directory.Exists(recycleDir))
                {
                    Directory.CreateDirectory(recycleDir);
                }
                Directory.Move(physicalPath, recyclePath);
            }

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FolderDelete,
                $"删除文件夹: {folder.Name}",
                $"路径: {folder.FullPath}");

            return Json(new { success = true, message = "删除成功" });
        }

        [HttpPost]
        public async Task<IActionResult> Rename(int folderId, string newName)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var folder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return Json(new { success = false, message = "文件夹不存在" });

            var hasPermission = await _permissionService.CheckPermissionAsync(folderId, userId, PermissionType.CanEdit, true);
            if (!hasPermission)
                return Json(new { success = false, message = "没有重命名权限" });

            // 检查重名
            var existingFolder = await _context.Folders
                .FirstOrDefaultAsync(f => f.ParentFolderId == folder.ParentFolderId && f.Name == newName && f.Id != folderId && !f.IsDeleted);

            if (existingFolder != null)
                return Json(new { success = false, message = "同名文件夹已存在" });

            var oldName = folder.Name;
            var oldPath = folder.FullPath;

            folder.Name = newName;
            folder.ModifiedAt = DateTime.UtcNow;

            // 更新路径
            var newPath = await BuildFolderPath(folder.ParentFolderId, newName);
            folder.FullPath = newPath;
            folder.Path = newPath;

            // 重命名物理文件夹
            var oldPhysicalPath = GetPhysicalPath(folder, oldName);
            var newPhysicalPath = GetPhysicalPath(folder);
            if (Directory.Exists(oldPhysicalPath) && !Directory.Exists(newPhysicalPath))
            {
                Directory.Move(oldPhysicalPath, newPhysicalPath);
            }

            // 更新所有子文件夹和文件的路径
            await UpdateChildrenPathsAsync(folder.Id, oldPath, newPath);

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FolderRename,
                $"重命名文件夹: {oldName} -> {newName}",
                $"路径: {newPath}");

            return Json(new { success = true, message = "重命名成功" });
        }

        [HttpPost]
        public async Task<IActionResult> Move(int folderId, int targetFolderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var folder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return Json(new { success = false, message = "文件夹不存在" });

            var targetFolder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == targetFolderId && !f.IsDeleted);

            if (targetFolder == null)
                return Json(new { success = false, message = "目标文件夹不存在" });

            // 检查源文件夹权限
            var hasSourcePermission = await _permissionService.CheckPermissionAsync(folderId, userId, PermissionType.CanEdit, true);
            if (!hasSourcePermission)
                return Json(new { success = false, message = "没有源文件夹的操作权限" });

            // 检查目标文件夹权限
            var hasTargetPermission = await _permissionService.CheckPermissionAsync(targetFolderId, userId, PermissionType.CanEdit, true);
            if (!hasTargetPermission)
                return Json(new { success = false, message = "没有目标文件夹的写入权限" });

            // 检查是否移动到自己的子文件夹（防止循环引用）
            if (await IsChildFolder(targetFolderId, folderId))
                return Json(new { success = false, message = "不能将文件夹移动到其子文件夹中" });

            // 检查重名
            var existingFolder = await _context.Folders
                .FirstOrDefaultAsync(f => f.ParentFolderId == targetFolderId && f.Name == folder.Name && !f.IsDeleted);

            if (existingFolder != null)
                return Json(new { success = false, message = "目标文件夹已存在同名文件夹" });

            var oldPath = folder.FullPath;
            var oldParentId = folder.ParentFolderId;

            folder.ParentFolderId = targetFolderId;
            folder.ModifiedAt = DateTime.UtcNow;

            // 更新路径
            var newPath = await BuildFolderPath(targetFolderId, folder.Name);
            folder.FullPath = newPath;
            folder.Path = newPath;

            // 移动物理文件夹
            var oldPhysicalPath = GetPhysicalPath(folder);
            var newPhysicalPath = GetPhysicalPathForParent(targetFolder, folder.Name);
            if (Directory.Exists(oldPhysicalPath) && !Directory.Exists(newPhysicalPath))
            {
                var directory = Path.GetDirectoryName(newPhysicalPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                Directory.Move(oldPhysicalPath, newPhysicalPath);
            }

            // 更新所有子文件夹和文件的路径
            await UpdateChildrenPathsAsync(folder.Id, oldPath, newPath);

            // 处理权限变更（如果移动到不同类型的文件夹）
            if (folder.Type != targetFolder.Type)
            {
                await HandleTypeChangePermissionAsync(folder, targetFolder.Type);
            }

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FolderMove,
                $"移动文件夹: {folder.Name}",
                $"从文件夹 {oldParentId} 到 {targetFolderId}");

            return Json(new { success = true, message = "移动成功" });
        }

        [HttpPost]
        public async Task<IActionResult> MoveToPublic(int folderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var folder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return Json(new { success = false, message = "文件夹不存在" });

            if (folder.OwnerId != userId)
                return Json(new { success = false, message = "只能移动自己的文件夹" });

            if (folder.Type == FolderType.Public)
                return Json(new { success = false, message = "文件夹已经是公开的" });

            folder.Type = FolderType.Public;

            // 更新物理路径
            var oldPhysicalPath = GetPhysicalPath(folder);
            var newPhysicalPath = GetPhysicalPath(folder);

            if (Directory.Exists(oldPhysicalPath) && !Directory.Exists(newPhysicalPath))
            {
                var directory = Path.GetDirectoryName(newPhysicalPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                Directory.Move(oldPhysicalPath, newPhysicalPath);
            }

            // 更新文件夹路径
            var newPath = await BuildFolderPath(folder.ParentFolderId, folder.Name);
            var oldPath = folder.FullPath;
            folder.FullPath = newPath;
            folder.Path = newPath;

            // 更新所有子项路径
            await UpdateChildrenPathsAsync(folder.Id, oldPath, newPath);

            // 添加所有者完全控制权限
            var ownerPermission = await _context.FolderPermissions
                .FirstOrDefaultAsync(fp => fp.FolderId == folderId && fp.UserId == userId);

            if (ownerPermission == null)
            {
                _context.FolderPermissions.Add(new FolderPermission
                {
                    FolderId = folderId,
                    UserId = userId,
                    Permission = PermissionType.FullControl,
                    GrantedAt = DateTime.UtcNow,
                    GrantedById = userId
                });
            }

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FolderMove,
                $"移动文件夹到公开区: {folder.Name}",
                $"新路径: {newPath}");

            return Json(new { success = true, message = "已移动到公开区" });
        }

        [HttpPost]
        public async Task<IActionResult> MoveToPrivate(int folderId, bool confirm = false)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var folder = await _context.Folders
                .Include(f => f.SubFolders)
                .Include(f => f.Files)
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return Json(new { success = false, message = "文件夹不存在" });

            if (folder.OwnerId != userId)
                return Json(new { success = false, message = "只能移动自己的文件夹" });

            if (folder.Type == FolderType.Private)
                return Json(new { success = false, message = "文件夹已经是私有的" });

            // 检查是否有子文件夹或文件需要处理
            var hasSubItems = folder.SubFolders.Any(f => !f.IsDeleted) || folder.Files.Any(f => !f.IsDeleted);
            if (hasSubItems)
            {
                if (confirm != true)
                {
                    var subFolderCount = folder.SubFolders.Count(f => !f.IsDeleted);
                    var fileCount = folder.Files.Count(f => !f.IsDeleted);
                    return Json(new
                    {
                        success = false,
                        needConfirm = true,
                        message = $"文件夹包含 {subFolderCount} 个子文件夹和 {fileCount} 个文件，移动到私有区后，其他用户的权限将被清除。是否继续？"
                    });
                }
            }

            // 更改文件夹类型
            folder.Type = FolderType.Private;
            folder.ModifiedAt = DateTime.UtcNow;

            // 更新物理路径
            var oldPhysicalPath = GetPhysicalPath(folder);
            var newPhysicalPath = GetPhysicalPath(folder);

            if (Directory.Exists(oldPhysicalPath) && !Directory.Exists(newPhysicalPath))
            {
                var directory = Path.GetDirectoryName(newPhysicalPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                Directory.Move(oldPhysicalPath, newPhysicalPath);
            }

            // 更新文件夹路径
            var newPath = await BuildFolderPath(folder.ParentFolderId, folder.Name);
            var oldPath = folder.FullPath;
            folder.FullPath = newPath;
            folder.Path = newPath;

            // 更新所有子项路径
            await UpdateChildrenPathsAsync(folder.Id, oldPath, newPath);

            // 清除所有其他用户的权限
            var permissions = await _context.FolderPermissions
                .Where(fp => fp.FolderId == folderId && fp.UserId != folder.OwnerId)
                .ToListAsync();
            _context.FolderPermissions.RemoveRange(permissions);

            // 清除子文件夹和文件的权限
            await ClearChildPermissionsAsync(folder.Id, folder.OwnerId);

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FolderMove,
                $"移动文件夹到私有区: {folder.Name}",
                $"新路径: {newPath}");

            return Json(new { success = true, message = "已移动到私有区" });
        }

        private async Task ClearChildPermissionsAsync(int folderId, int ownerId)
        {
            // 清除子文件夹权限
            var subFolders = await _context.Folders
                .Where(f => f.ParentFolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var subFolder in subFolders)
            {
                var subPermissions = await _context.FolderPermissions
                    .Where(fp => fp.FolderId == subFolder.Id && fp.UserId != ownerId)
                    .ToListAsync();
                _context.FolderPermissions.RemoveRange(subPermissions);

                await ClearChildPermissionsAsync(subFolder.Id, ownerId);
            }

            // 清除文件权限
            var files = await _context.Files
                .Where(f => f.FolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var file in files)
            {
                var filePermissions = await _context.FilePermissions
                    .Where(fp => fp.FileId == file.Id && fp.UserId != ownerId)
                    .ToListAsync();
                _context.FilePermissions.RemoveRange(filePermissions);
            }
        }

        private async Task<int> GetFolderDepth(int? parentFolderId)
        {
            int depth = 0;
            var currentId = parentFolderId;
            while (currentId.HasValue)
            {
                depth++;
                var folder = await _context.Folders.FindAsync(currentId.Value);
                currentId = folder?.ParentFolderId;
            }
            return depth;
        }

        private async Task<string> BuildFolderPath(int? parentFolderId, string folderName)
        {
            if (!parentFolderId.HasValue)
                return folderName;

            var parentFolder = await _context.Folders.FindAsync(parentFolderId.Value);
            if (parentFolder == null)
                return folderName;

            var parentPath = parentFolder.FullPath ?? parentFolder.Path ?? "";
            return Path.Combine(parentPath, folderName);
        }

        private string GetPhysicalPath(Folder folder, string? overrideName = null)
        {
            var basePath = folder.Type == FolderType.Private ? "Private" : "Public";
            var ownerName = folder.Owner?.Username ?? "unknown";
            var folderName = overrideName ?? folder.Name;

            var folderPath = folder.FullPath ?? folder.Path ?? "";
            if (!string.IsNullOrEmpty(folderPath) && folderPath.EndsWith(folder.Name))
            {
                folderPath = folderPath.Substring(0, folderPath.Length - folder.Name.Length).TrimEnd(Path.DirectorySeparatorChar);
            }

            return Path.Combine(_storageRoot, basePath, ownerName, folderPath, folderName);
        }

        private string GetPhysicalPathForParent(Folder parentFolder, string folderName)
        {
            var basePath = parentFolder.Type == FolderType.Private ? "Private" : "Public";
            var ownerName = parentFolder.Owner?.Username ?? "unknown";
            var folderPath = parentFolder.FullPath ?? parentFolder.Path ?? "";

            return Path.Combine(_storageRoot, basePath, ownerName, folderPath, folderName);
        }

        private async Task UpdateChildrenPathsAsync(int folderId, string oldPath, string newPath)
        {
            var subFolders = await _context.Folders
                .Where(f => f.ParentFolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var subFolder in subFolders)
            {
                var subOldPath = subFolder.FullPath;
                var subNewPath = subOldPath?.Replace(oldPath, newPath);
                subFolder.FullPath = subNewPath;
                subFolder.Path = subNewPath;

                await UpdateChildrenPathsAsync(subFolder.Id, subOldPath ?? "", subNewPath ?? "");
            }

            var files = await _context.Files
                .Where(f => f.FolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var file in files)
            {
                file.PhysicalPath = file.PhysicalPath.Replace(oldPath, newPath);
            }
        }

        private async Task<bool> IsChildFolder(int parentId, int childId)
        {
            var currentId = parentId;
            while (currentId > 0)
            {
                if (currentId == childId)
                    return true;

                var folder = await _context.Folders.FindAsync(currentId);
                currentId = folder?.ParentFolderId ?? 0;
            }
            return false;
        }

        private async Task HandleTypeChangePermissionAsync(Folder folder, FolderType newType)
        {
            if (newType == FolderType.Private)
            {
                // 移动到私有：清除所有其他用户的权限
                var permissions = await _context.FolderPermissions
                    .Where(fp => fp.FolderId == folder.Id && fp.UserId != folder.OwnerId)
                    .ToListAsync();
                _context.FolderPermissions.RemoveRange(permissions);
            }
            else
            {
                // 移动到公开：默认其他用户获得仅查看权限
                var users = await _context.Users
                    .Where(u => u.Id != folder.OwnerId && u.IsActive)
                    .ToListAsync();

                foreach (var user in users)
                {
                    var existing = await _context.FolderPermissions
                        .FirstOrDefaultAsync(fp => fp.FolderId == folder.Id && fp.UserId == user.Id);

                    if (existing == null)
                    {
                        _context.FolderPermissions.Add(new FolderPermission
                        {
                            FolderId = folder.Id,
                            UserId = user.Id,
                            Permission = PermissionType.ViewOnly,
                            IsInherited = true,
                            GrantedAt = DateTime.UtcNow,
                            GrantedById = folder.OwnerId
                        });
                    }
                }
            }
        }
    }
}