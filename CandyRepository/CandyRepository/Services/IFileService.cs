using CandyRepository.Models;

namespace CandyRepository.Services
{
    public interface IFileService
    {
        Task<OperationResult> UploadFileAsync(IFormFile file, int folderId, int userId);
        Task<byte[]> DownloadFileAsync(int fileId, int userId);
        Task<OperationResult> DeleteFileAsync(int fileId, int userId, bool softDelete = true);
        Task<OperationResult> RestoreFileAsync(int recycleBinId, int userId);
        Task<OperationResult> MoveFileAsync(int fileId, int targetFolderId, int userId);
        Task<OperationResult> RenameFileAsync(int fileId, string newName, int userId);
        Task<byte[]> BatchDownloadAsync(List<int> fileIds, int userId);
        Task<List<Models.File>> SearchFilesAsync(string searchTerm, int userId, string? fileType = null);
        Task<OperationResult> UpdateFilePermissionAsync(int fileId, int targetUserId, PermissionType permission, int userId);
    }

    public class OperationResult
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public object? Data { get; set; }

        public static OperationResult Ok(string? message = null, object? data = null)
        {
            return new OperationResult { Success = true, Message = message, Data = data };
        }

        public static OperationResult Fail(string message)
        {
            return new OperationResult { Success = false, Message = message };
        }
    }
}