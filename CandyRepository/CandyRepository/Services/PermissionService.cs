using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;

namespace CandyRepository.Services
{
    public class PermissionService : IPermissionService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogService _logService;

        public PermissionService(ApplicationDbContext context, ILogService logService)
        {
            _context = context;
            _logService = logService;
        }

        public async Task<bool> CheckPermissionAsync(int folderId, int userId, PermissionType requiredPermission, bool includeInheritance = true)
        {
            // 管理员拥有所有权限
            var user = await _context.Users.FindAsync(userId);
            if (user?.IsAdmin == true)
                return true;

            var permission = await GetUserFolderPermissionAsync(folderId, userId);
            return permission >= requiredPermission;
        }

        public async Task<PermissionType> GetUserFolderPermissionAsync(int folderId, int userId)
        {
            var folder = await _context.Folders
                .Include(f => f.Owner)
                .FirstOrDefaultAsync(f => f.Id == folderId);

            if (folder == null)
                return PermissionType.NoPermission;

            // 文件夹所有者拥有完全控制权
            if (folder.OwnerId == userId)
                return PermissionType.FullControl;

            // 私有文件夹：只有所有者可见
            if (folder.Type == FolderType.Private)
                return PermissionType.NoPermission;

            // 公开文件夹：检查权限设置
            var permission = await _context.FolderPermissions
                .FirstOrDefaultAsync(fp => fp.FolderId == folderId && fp.UserId == userId);

            if (permission != null)
                return permission.Permission;

            // 默认权限：仅查看
            return PermissionType.ViewOnly;
        }

        public async Task<PermissionType> GetUserFilePermissionAsync(int fileId, int userId)
        {
            var file = await _context.Files
                .Include(f => f.Folder)
                .ThenInclude(f => f!.Owner)
                .FirstOrDefaultAsync(f => f.Id == fileId);

            if (file == null)
                return PermissionType.NoPermission;

            // 检查文件特定权限
            var filePermission = await _context.FilePermissions
                .FirstOrDefaultAsync(fp => fp.FileId == fileId && fp.UserId == userId);

            if (filePermission != null && !filePermission.IsInherited)
                return filePermission.Permission;

            // 继承文件夹权限
            return await GetUserFolderPermissionAsync(file.FolderId, userId);
        }

        public async Task<List<Folder>> GetAccessibleFoldersAsync(int userId, PermissionType minPermission)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user?.IsAdmin == true)
            {
                return await _context.Folders
                    .Where(f => !f.IsDeleted)
                    .ToListAsync();
            }

            // 用户拥有的私有文件夹
            var ownedFolders = await _context.Folders
                .Where(f => f.OwnerId == userId && !f.IsDeleted)
                .ToListAsync();

            // 公开文件夹中用户有权限的
            var publicFolders = await _context.Folders
                .Where(f => f.Type == FolderType.Public && !f.IsDeleted)
                .ToListAsync();

            var accessibleFolders = new List<Folder>(ownedFolders);

            foreach (var folder in publicFolders)
            {
                var permission = await GetUserFolderPermissionAsync(folder.Id, userId);
                if (permission >= minPermission)
                {
                    accessibleFolders.Add(folder);
                }
            }

            return accessibleFolders;
        }

        public async Task<OperationResult> SetFolderPermissionAsync(int folderId, int targetUserId, PermissionType permission, int grantedByUserId, bool applyToChildren = false)
        {
            var folder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == folderId);

            if (folder == null)
                return OperationResult.Fail("文件夹不存在");

            // 只有所有者可以设置权限
            if (folder.OwnerId != grantedByUserId)
                return OperationResult.Fail("只有文件夹所有者可以设置权限");

            var existingPermission = await _context.FolderPermissions
                .FirstOrDefaultAsync(fp => fp.FolderId == folderId && fp.UserId == targetUserId);

            if (existingPermission != null)
            {
                existingPermission.Permission = permission;
                existingPermission.GrantedAt = DateTime.UtcNow;
                existingPermission.GrantedById = grantedByUserId;
            }
            else
            {
                var newPermission = new FolderPermission
                {
                    FolderId = folderId,
                    UserId = targetUserId,
                    Permission = permission,
                    IsInherited = false,
                    GrantedAt = DateTime.UtcNow,
                    GrantedById = grantedByUserId
                };
                _context.FolderPermissions.Add(newPermission);
            }

            await _context.SaveChangesAsync();

            // 如果选择应用到子项
            if (applyToChildren)
            {
                await ApplyPermissionToChildrenAsync(folderId, targetUserId, permission);
            }

            await _logService.LogAsync(grantedByUserId, OperationType.PermissionChange,
                $"设置文件夹权限: {folder.Name}",
                $"用户 {targetUserId} 获得权限 {permission}, 应用到子项: {applyToChildren}");

            return OperationResult.Ok("权限设置成功");
        }

        private async Task ApplyPermissionToChildrenAsync(int folderId, int userId, PermissionType permission)
        {
            var subFolders = await _context.Folders
                .Where(f => f.ParentFolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var subFolder in subFolders)
            {
                var existingPermission = await _context.FolderPermissions
                    .FirstOrDefaultAsync(fp => fp.FolderId == subFolder.Id && fp.UserId == userId);

                if (existingPermission != null)
                {
                    existingPermission.Permission = permission;
                }
                else
                {
                    var newPermission = new FolderPermission
                    {
                        FolderId = subFolder.Id,
                        UserId = userId,
                        Permission = permission,
                        IsInherited = true,
                        GrantedAt = DateTime.UtcNow,
                        GrantedById = userId
                    };
                    _context.FolderPermissions.Add(newPermission);
                }

                await ApplyPermissionToChildrenAsync(subFolder.Id, userId, permission);
            }

            // 更新文件夹内文件的权限
            var files = await _context.Files
                .Where(f => f.FolderId == folderId && !f.IsDeleted)
                .ToListAsync();

            foreach (var file in files)
            {
                var existingFilePermission = await _context.FilePermissions
                    .FirstOrDefaultAsync(fp => fp.FileId == file.Id && fp.UserId == userId);

                if (existingFilePermission != null)
                {
                    existingFilePermission.Permission = permission;
                    existingFilePermission.IsInherited = true;
                }
                else
                {
                    var newFilePermission = new FilePermission
                    {
                        FileId = file.Id,
                        UserId = userId,
                        Permission = permission,
                        IsInherited = true,
                        GrantedAt = DateTime.UtcNow,
                        GrantedById = userId
                    };
                    _context.FilePermissions.Add(newFilePermission);
                }
            }

            await _context.SaveChangesAsync();
        }

        public async Task<OperationResult> RemoveFolderPermissionAsync(int folderId, int targetUserId, int userId)
        {
            var folder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == folderId);

            if (folder == null)
                return OperationResult.Fail("文件夹不存在");

            if (folder.OwnerId != userId)
                return OperationResult.Fail("只有文件夹所有者可以移除权限");

            var permission = await _context.FolderPermissions
                .FirstOrDefaultAsync(fp => fp.FolderId == folderId && fp.UserId == targetUserId);

            if (permission != null)
            {
                _context.FolderPermissions.Remove(permission);
                await _context.SaveChangesAsync();

                await _logService.LogAsync(userId, OperationType.PermissionChange,
                    $"移除文件夹权限: {folder.Name}",
                    $"用户 {targetUserId}");

                return OperationResult.Ok("权限移除成功");
            }

            return OperationResult.Fail("权限记录不存在");
        }

        public async Task<List<FolderPermission>> GetFolderPermissionsAsync(int folderId)
        {
            return await _context.FolderPermissions
                .Include(fp => fp.User)
                .Include(fp => fp.GrantedBy)
                .Where(fp => fp.FolderId == folderId)
                .ToListAsync();
        }

        public async Task<OperationResult> InheritPermissionsFromParentAsync(int folderId)
        {
            var folder = await _context.Folders
                .Include(f => f.ParentFolder)
                .FirstOrDefaultAsync(f => f.Id == folderId);

            if (folder?.ParentFolder == null)
                return OperationResult.Fail("没有父文件夹");

            var parentPermissions = await _context.FolderPermissions
                .Where(fp => fp.FolderId == folder.ParentFolderId)
                .ToListAsync();

            foreach (var parentPerm in parentPermissions)
            {
                var existingPerm = await _context.FolderPermissions
                    .FirstOrDefaultAsync(fp => fp.FolderId == folderId && fp.UserId == parentPerm.UserId);

                if (existingPerm == null)
                {
                    var newPerm = new FolderPermission
                    {
                        FolderId = folderId,
                        UserId = parentPerm.UserId,
                        Permission = parentPerm.Permission,
                        IsInherited = true,
                        GrantedAt = DateTime.UtcNow,
                        GrantedById = parentPerm.GrantedById
                    };
                    _context.FolderPermissions.Add(newPerm);
                }
            }

            await _context.SaveChangesAsync();
            return OperationResult.Ok("继承权限成功");
        }
    }
}