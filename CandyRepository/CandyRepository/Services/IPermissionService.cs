using CandyRepository.Models;

namespace CandyRepository.Services
{
    public interface IPermissionService
    {
        Task<bool> CheckPermissionAsync(int folderId, int userId, PermissionType requiredPermission, bool includeInheritance = true);
        Task<PermissionType> GetUserFolderPermissionAsync(int folderId, int userId);
        Task<PermissionType> GetUserFilePermissionAsync(int fileId, int userId);
        Task<List<Folder>> GetAccessibleFoldersAsync(int userId, PermissionType minPermission);
        Task<OperationResult> SetFolderPermissionAsync(int folderId, int targetUserId, PermissionType permission, int grantedByUserId, bool applyToChildren = false);
        Task<OperationResult> RemoveFolderPermissionAsync(int folderId, int targetUserId, int userId);
        Task<List<FolderPermission>> GetFolderPermissionsAsync(int folderId);
        Task<OperationResult> InheritPermissionsFromParentAsync(int folderId);
    }
}