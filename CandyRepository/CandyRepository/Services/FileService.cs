using Microsoft.EntityFrameworkCore;
using System.IO.Compression;
using System.Security.Cryptography;
using CandyRepository.Data;
using CandyRepository.Models;

namespace CandyRepository.Services
{
    public class FileService : IFileService
    {
        private readonly ApplicationDbContext _context;
        private readonly IPermissionService _permissionService;
        private readonly ILogService _logService;
        private readonly IConfiguration _configuration;
        private readonly string _storageRoot;

        public FileService(
            ApplicationDbContext context,
            IPermissionService permissionService,
            ILogService logService,
            IConfiguration configuration)
        {
            _context = context;
            _permissionService = permissionService;
            _logService = logService;
            _configuration = configuration;
            _storageRoot = _configuration["Storage:RootPath"] ?? @"E:\CandyRepository\";

            // 确保存储目录存在
            EnsureStorageDirectories();
        }

        private void EnsureStorageDirectories()
        {
            var directories = new[]
            {
                Path.Combine(_storageRoot, "Private"),
                Path.Combine(_storageRoot, "Public"),
                Path.Combine(_storageRoot, "Recycle")
            };

            foreach (var dir in directories)
            {
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
            }
        }

        public async Task<OperationResult> UploadFileAsync(IFormFile file, int folderId, int userId)
        {
            try
            {
                // 检查权限
                var folder = await _context.Folders
                    .Include(f => f.Owner)
                    .FirstOrDefaultAsync(f => f.Id == folderId);

                if (folder == null)
                    return OperationResult.Fail("文件夹不存在");

                var hasPermission = await _permissionService.CheckPermissionAsync(folderId, userId, PermissionType.CanEdit, true);
                if (!hasPermission)
                    return OperationResult.Fail("没有上传权限");

                // 检查文件大小
                var maxFileSize = _configuration.GetValue<long>("Storage:MaxFileSize", 100 * 1024 * 1024);
                if (file.Length > maxFileSize)
                    return OperationResult.Fail($"文件大小超过限制 ({maxFileSize / 1024 / 1024}MB)");

                // 计算文件哈希
                var hash = await ComputeFileHashAsync(file);

                // 检查重名
                var existingFile = await _context.Files
                    .FirstOrDefaultAsync(f => f.FolderId == folderId && f.Name == file.FileName && !f.IsDeleted);

                if (existingFile != null)
                    return OperationResult.Fail("同名文件已存在");

                // 构建物理路径
                var relativePath = BuildPhysicalPath(folder, file.FileName);
                var physicalPath = Path.Combine(_storageRoot, relativePath);

                // 确保目录存在
                var directory = Path.GetDirectoryName(physicalPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                // 保存文件
                using (var stream = new FileStream(physicalPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // 创建数据库记录
                var dbFile = new Models.File
                {
                    Name = file.FileName,
                    PhysicalPath = relativePath,
                    Size = file.Length,
                    ContentType = file.ContentType,
                    FileHash = hash,
                    FolderId = folderId,
                    UploadedById = userId,
                    UploadedAt = DateTime.UtcNow,
                    ModifiedAt = DateTime.UtcNow
                };

                _context.Files.Add(dbFile);
                await _context.SaveChangesAsync();

                // 记录日志
                await _logService.LogAsync(userId, OperationType.FileUpload,
                    $"{file.FileName} 上传到 {folder.Name}",
                    $"大小: {file.Length} bytes");

                return OperationResult.Ok("上传成功", dbFile);
            }
            catch (Exception ex)
            {
                return OperationResult.Fail($"上传失败: {ex.Message}");
            }
        }

        public async Task<byte[]> DownloadFileAsync(int fileId, int userId)
        {
            var file = await _context.Files
                .Include(f => f.Folder)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                throw new Exception("文件不存在");

            var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.CanDownload, true);
            if (!hasPermission)
                throw new Exception("没有下载权限");

            var physicalPath = Path.Combine(_storageRoot, file.PhysicalPath);
            if (!System.IO.File.Exists(physicalPath))
                throw new Exception("物理文件不存在");

            // 记录下载日志
            await _logService.LogAsync(userId, OperationType.FileDownload,
                $"下载文件: {file.Name}",
                $"路径: {file.PhysicalPath}");

            return await System.IO.File.ReadAllBytesAsync(physicalPath);
        }

        public async Task<OperationResult> DeleteFileAsync(int fileId, int userId, bool softDelete = true)
        {
            var file = await _context.Files
                .Include(f => f.Folder)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return OperationResult.Fail("文件不存在");

            var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.FullControl, true);
            if (!hasPermission)
                return OperationResult.Fail("没有删除权限");

            if (softDelete)
            {
                // 软删除 - 移动到回收站
                file.IsDeleted = true;

                // 记录到回收站
                var recycleItem = new RecycleBin
                {
                    ItemType = DeletedItemType.File,
                    ItemId = file.Id,
                    OriginalPath = file.PhysicalPath,
                    Name = file.Name,
                    DeletedByUserId = userId,
                    DeletedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddDays(30)
                };

                _context.RecycleBin.Add(recycleItem);
                await _context.SaveChangesAsync();

                await _logService.LogAsync(userId, OperationType.FileDelete,
                    $"删除文件: {file.Name}",
                    $"原路径: {file.PhysicalPath}");
            }
            else
            {
                // 物理删除
                var physicalPath = Path.Combine(_storageRoot, file.PhysicalPath);
                if (System.IO.File.Exists(physicalPath))
                {
                    System.IO.File.Delete(physicalPath);
                }

                _context.Files.Remove(file);
                await _context.SaveChangesAsync();

                await _logService.LogAsync(userId, OperationType.FileDelete,
                    $"彻底删除文件: {file.Name}",
                    $"物理路径: {physicalPath}");
            }

            return OperationResult.Ok("删除成功");
        }

        public async Task<OperationResult> RestoreFileAsync(int recycleBinId, int userId)
        {
            var recycleItem = await _context.RecycleBin
                .FirstOrDefaultAsync(r => r.Id == recycleBinId);

            if (recycleItem == null)
                return OperationResult.Fail("回收站记录不存在");

            if (recycleItem.ItemType == DeletedItemType.File)
            {
                var file = await _context.Files
                    .FirstOrDefaultAsync(f => f.Id == recycleItem.ItemId);

                if (file != null)
                {
                    file.IsDeleted = false;
                    _context.RecycleBin.Remove(recycleItem);
                    await _context.SaveChangesAsync();

                    await _logService.LogAsync(userId, OperationType.FileRestore,
                        $"恢复文件: {file.Name}",
                        $"原路径: {recycleItem.OriginalPath}");

                    return OperationResult.Ok("恢复成功");
                }
            }

            return OperationResult.Fail("恢复失败");
        }

        public async Task<OperationResult> MoveFileAsync(int fileId, int targetFolderId, int userId)
        {
            var file = await _context.Files
                .Include(f => f.Folder)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return OperationResult.Fail("文件不存在");

            var targetFolder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == targetFolderId && !f.IsDeleted);

            if (targetFolder == null)
                return OperationResult.Fail("目标文件夹不存在");

            // 检查源文件夹权限
            var hasSourcePermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.CanEdit, true);
            if (!hasSourcePermission)
                return OperationResult.Fail("没有源文件的操作权限");

            // 检查目标文件夹权限
            var hasTargetPermission = await _permissionService.CheckPermissionAsync(targetFolderId, userId, PermissionType.CanEdit, true);
            if (!hasTargetPermission)
                return OperationResult.Fail("没有目标文件夹的写入权限");

            // 检查重名
            var existingFile = await _context.Files
                .FirstOrDefaultAsync(f => f.FolderId == targetFolderId && f.Name == file.Name && !f.IsDeleted);

            if (existingFile != null)
                return OperationResult.Fail("目标文件夹已存在同名文件");

            // 移动物理文件
            var oldPhysicalPath = Path.Combine(_storageRoot, file.PhysicalPath);
            var newRelativePath = BuildPhysicalPath(targetFolder, file.Name);
            var newPhysicalPath = Path.Combine(_storageRoot, newRelativePath);

            if (System.IO.File.Exists(oldPhysicalPath))
            {
                var directory = Path.GetDirectoryName(newPhysicalPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                System.IO.File.Move(oldPhysicalPath, newPhysicalPath);
            }

            // 更新数据库
            file.FolderId = targetFolderId;
            file.PhysicalPath = newRelativePath;
            file.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FileMove,
                $"移动文件: {file.Name}",
                $"从 {file.Folder?.Name} 到 {targetFolder.Name}");

            return OperationResult.Ok("移动成功");
        }

        public async Task<OperationResult> RenameFileAsync(int fileId, string newName, int userId)
        {
            var file = await _context.Files
                .Include(f => f.Folder)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return OperationResult.Fail("文件不存在");

            var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.CanEdit, true);
            if (!hasPermission)
                return OperationResult.Fail("没有重命名权限");

            // 检查重名
            var existingFile = await _context.Files
                .FirstOrDefaultAsync(f => f.FolderId == file.FolderId && f.Name == newName && f.Id != fileId && !f.IsDeleted);

            if (existingFile != null)
                return OperationResult.Fail("同名文件已存在");

            // 重命名物理文件
            var oldPhysicalPath = Path.Combine(_storageRoot, file.PhysicalPath);
            var newRelativePath = BuildPhysicalPath(file.Folder!, newName);
            var newPhysicalPath = Path.Combine(_storageRoot, newRelativePath);

            if (System.IO.File.Exists(oldPhysicalPath))
            {
                System.IO.File.Move(oldPhysicalPath, newPhysicalPath);
            }

            // 更新数据库
            var oldName = file.Name;
            file.Name = newName;
            file.PhysicalPath = newRelativePath;
            file.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.FileRename,
                $"重命名文件: {oldName} -> {newName}",
                $"路径: {file.PhysicalPath}");

            return OperationResult.Ok("重命名成功");
        }

        public async Task<byte[]> BatchDownloadAsync(List<int> fileIds, int userId)
        {
            using (var memoryStream = new MemoryStream())
            {
                using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
                {
                    foreach (var fileId in fileIds)
                    {
                        var file = await _context.Files
                            .Include(f => f.Folder)
                            .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

                        if (file == null)
                            continue;

                        var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.CanDownload, true);
                        if (!hasPermission)
                            continue;

                        var physicalPath = Path.Combine(_storageRoot, file.PhysicalPath);
                        if (System.IO.File.Exists(physicalPath))
                        {
                            var entry = archive.CreateEntry(file.Name);
                            using (var entryStream = entry.Open())
                            using (var fileStream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read))
                            {
                                await fileStream.CopyToAsync(entryStream);
                            }
                        }
                    }
                }

                await _logService.LogAsync(userId, OperationType.FileDownload,
                    $"批量下载 {fileIds.Count} 个文件",
                    $"文件列表: {string.Join(", ", fileIds)}");

                return memoryStream.ToArray();
            }
        }

        public async Task<List<Models.File>> SearchFilesAsync(string searchTerm, int userId, string? fileType = null)
        {
            var accessibleFolders = await _permissionService.GetAccessibleFoldersAsync(userId, PermissionType.ViewOnly);
            var folderIds = accessibleFolders.Select(f => f.Id).ToList();

            var query = _context.Files
                .Include(f => f.Folder)
                .Where(f => folderIds.Contains(f.FolderId) && !f.IsDeleted)
                .Where(f => f.Name.Contains(searchTerm));

            if (!string.IsNullOrEmpty(fileType))
            {
                query = query.Where(f => f.ContentType != null && f.ContentType.Contains(fileType));
            }

            return await query.ToListAsync();
        }

        public async Task<OperationResult> UpdateFilePermissionAsync(int fileId, int targetUserId, PermissionType permission, int userId)
        {
            var file = await _context.Files
                .Include(f => f.Folder)
                .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted);

            if (file == null)
                return OperationResult.Fail("文件不存在");

            // 检查用户是否有权限设置文件权限（需要完全控制权限）
            var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.FullControl, true);
            if (!hasPermission)
                return OperationResult.Fail("没有权限设置文件权限");

            var existingPermission = await _context.FilePermissions
                .FirstOrDefaultAsync(fp => fp.FileId == fileId && fp.UserId == targetUserId);

            if (existingPermission != null)
            {
                existingPermission.Permission = permission;
                existingPermission.IsInherited = false;
                existingPermission.GrantedAt = DateTime.UtcNow;
                existingPermission.GrantedById = userId;
            }
            else
            {
                var newPermission = new FilePermission
                {
                    FileId = fileId,
                    UserId = targetUserId,
                    Permission = permission,
                    IsInherited = false,
                    GrantedAt = DateTime.UtcNow,
                    GrantedById = userId
                };
                _context.FilePermissions.Add(newPermission);
            }

            await _context.SaveChangesAsync();

            await _logService.LogAsync(userId, OperationType.PermissionChange,
                $"修改文件权限: {file.Name}",
                $"用户 {targetUserId} 获得权限 {permission}");

            return OperationResult.Ok("权限设置成功");
        }

        private async Task<string> ComputeFileHashAsync(IFormFile file)
        {
            using (var md5 = MD5.Create())
            using (var stream = file.OpenReadStream())
            {
                var hash = await md5.ComputeHashAsync(stream);
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }

        private string BuildPhysicalPath(Folder folder, string fileName)
        {
            var basePath = folder.Type == FolderType.Private ? "Private" : "Public";
            var ownerName = folder.Owner?.Username ?? "unknown";

            // 获取文件夹的相对路径
            var folderRelativePath = folder.FullPath ?? folder.Path ?? "";

            return Path.Combine(basePath, ownerName, folderRelativePath, fileName);
        }
    }
}