using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;

namespace CandyRepository.Controllers
{
    public class PermissionController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IPermissionService _permissionService;
        private readonly ILogService _logService;

        public PermissionController(
            ApplicationDbContext context,
            IPermissionService permissionService,
            ILogService logService)
        {
            _context = context;
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

        [HttpGet]
        public async Task<IActionResult> FolderPermissions(int folderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            var folder = await _context.Folders
                .Include(f => f.Owner)
                .FirstOrDefaultAsync(f => f.Id == folderId && !f.IsDeleted);

            if (folder == null)
                return NotFound();

            // 检查是否有权限管理权限（需要完全控制）
            var hasPermission = await _permissionService.CheckPermissionAsync(folderId, userId, PermissionType.FullControl, true);
            if (!hasPermission)
                return Forbid();

            var permissions = await _permissionService.GetFolderPermissionsAsync(folderId);

            // 获取所有活跃用户（排除当前文件夹所有者）
            var allUsers = await _context.Users
                .Where(u => u.IsActive && u.Id != folder.OwnerId)
                .Select(u => new { u.Id, u.Username })
                .ToListAsync();

            var permissionTypes = Enum.GetValues(typeof(PermissionType))
                .Cast<PermissionType>()
                .Where(p => p != PermissionType.NoPermission)
                .ToList();

            ViewBag.Folder = folder;
            ViewBag.Permissions = permissions;
            ViewBag.AllUsers = allUsers;
            ViewBag.PermissionTypes = permissionTypes;

            return View();
        }

        [HttpPost]
        public async Task<IActionResult> AddFolderPermission(int folderId, int userId, PermissionType permission, bool applyToChildren = false)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Json(new { success = false, message = "未登录" });

            var result = await _permissionService.SetFolderPermissionAsync(folderId, userId, permission, currentUserId, applyToChildren);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpPost]
        public async Task<IActionResult> RemoveFolderPermission(int folderId, int permissionId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Json(new { success = false, message = "未登录" });

            var permission = await _context.FolderPermissions
                .FirstOrDefaultAsync(fp => fp.Id == permissionId && fp.FolderId == folderId);

            if (permission == null)
                return Json(new { success = false, message = "权限记录不存在" });

            var result = await _permissionService.RemoveFolderPermissionAsync(folderId, permission.UserId, currentUserId);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpGet]
        public async Task<IActionResult> FilePermissions(int fileId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            var file = await _context.Files
                .Include(f => f.Folder)
                .ThenInclude(f => f!.Owner)
                .Include(f => f.UploadedBy)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return NotFound();

            // 检查是否有权限管理权限（需要完全控制）
            var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.FullControl, true);
            if (!hasPermission)
                return Forbid();

            var permissions = await _context.FilePermissions
                .Include(fp => fp.User)
                .Include(fp => fp.GrantedBy)
                .Where(fp => fp.FileId == fileId)
                .ToListAsync();

            // 获取所有活跃用户（排除文件上传者）
            var allUsers = await _context.Users
                .Where(u => u.IsActive && u.Id != file.UploadedById)
                .Select(u => new { u.Id, u.Username })
                .ToListAsync();

            // 获取继承的权限
            var inheritedPermission = await _permissionService.GetUserFolderPermissionAsync(file.FolderId, userId);

            var permissionTypes = Enum.GetValues(typeof(PermissionType))
                .Cast<PermissionType>()
                .Where(p => p != PermissionType.NoPermission)
                .ToList();

            ViewBag.File = file;
            ViewBag.Permissions = permissions;
            ViewBag.AllUsers = allUsers;
            ViewBag.InheritedPermission = inheritedPermission;
            ViewBag.PermissionTypes = permissionTypes;

            return View();
        }

        [HttpPost]
        public async Task<IActionResult> AddFilePermission(int fileId, int userId, PermissionType permission)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Json(new { success = false, message = "未登录" });

            var file = await _context.Files
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return Json(new { success = false, message = "文件不存在" });

            var existingPermission = await _context.FilePermissions
                .FirstOrDefaultAsync(fp => fp.FileId == fileId && fp.UserId == userId);

            if (existingPermission != null)
            {
                existingPermission.Permission = permission;
                existingPermission.IsInherited = false;
                existingPermission.GrantedAt = DateTime.UtcNow;
                existingPermission.GrantedById = currentUserId;
            }
            else
            {
                var newPermission = new FilePermission
                {
                    FileId = fileId,
                    UserId = userId,
                    Permission = permission,
                    IsInherited = false,
                    GrantedAt = DateTime.UtcNow,
                    GrantedById = currentUserId
                };
                _context.FilePermissions.Add(newPermission);
            }

            await _context.SaveChangesAsync();

            await _logService.LogAsync(currentUserId, OperationType.PermissionChange,
                $"修改文件权限: {file.Name}",
                $"用户 {userId} 获得权限 {permission}");

            return Json(new { success = true, message = "权限设置成功" });
        }

        [HttpPost]
        public async Task<IActionResult> RemoveFilePermission(int fileId, int permissionId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Json(new { success = false, message = "未登录" });

            var permission = await _context.FilePermissions
                .FirstOrDefaultAsync(fp => fp.Id == permissionId && fp.FileId == fileId);

            if (permission == null)
                return Json(new { success = false, message = "权限记录不存在" });

            _context.FilePermissions.Remove(permission);
            await _context.SaveChangesAsync();

            var file = await _context.Files.FindAsync(fileId);
            await _logService.LogAsync(currentUserId, OperationType.PermissionChange,
                $"移除文件权限: {file?.Name}",
                $"用户 {permission.UserId}");

            return Json(new { success = true, message = "权限移除成功" });
        }

        [HttpPost]
        public async Task<IActionResult> InheritFromParent(int fileId)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Json(new { success = false, message = "未登录" });

            var file = await _context.Files
                .Include(f => f.Folder)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return Json(new { success = false, message = "文件不存在" });

            // 删除所有非继承的权限
            var permissions = await _context.FilePermissions
                .Where(fp => fp.FileId == fileId && !fp.IsInherited)
                .ToListAsync();

            _context.FilePermissions.RemoveRange(permissions);
            await _context.SaveChangesAsync();

            await _logService.LogAsync(currentUserId, OperationType.PermissionChange,
                $"恢复继承权限: {file.Name}",
                $"从父文件夹 {file.Folder?.Name}");

            return Json(new { success = true, message = "已恢复继承父文件夹权限" });
        }
    }
}