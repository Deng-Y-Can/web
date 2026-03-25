using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;

namespace CandyRepository.Controllers
{
    public class FileController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IFileService _fileService;
        private readonly IPermissionService _permissionService;
        private readonly ILogService _logService;

        public FileController(
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

        [HttpPost]
        public async Task<IActionResult> Upload(IFormFile file, int folderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            if (file == null || file.Length == 0)
                return Json(new { success = false, message = "请选择文件" });

            var result = await _fileService.UploadFileAsync(file, folderId, userId);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpPost]
        public async Task<IActionResult> UploadMultiple(List<IFormFile> files, int folderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var results = new List<object>();
            int successCount = 0;
            int failCount = 0;

            foreach (var file in files)
            {
                var result = await _fileService.UploadFileAsync(file, folderId, userId);
                if (result.Success)
                    successCount++;
                else
                    failCount++;

                results.Add(new { fileName = file.FileName, success = result.Success, message = result.Message });
            }

            return Json(new
            {
                success = true,
                successCount = successCount,
                failCount = failCount,
                details = results
            });
        }

        [HttpGet]
        public async Task<IActionResult> Download(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            try
            {
                var file = await _context.Files
                    .FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);

                if (file == null)
                    return NotFound();

                var fileBytes = await _fileService.DownloadFileAsync(id, userId);

                return File(fileBytes, file.ContentType ?? "application/octet-stream", file.Name);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var result = await _fileService.DeleteFileAsync(id, userId, true);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpPost]
        public async Task<IActionResult> PermanentDelete(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var result = await _fileService.DeleteFileAsync(id, userId, false);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpPost]
        public async Task<IActionResult> Rename(int id, string newName)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var result = await _fileService.RenameFileAsync(id, newName, userId);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpPost]
        public async Task<IActionResult> Move(int id, int targetFolderId)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var result = await _fileService.MoveFileAsync(id, targetFolderId, userId);

            return Json(new { success = result.Success, message = result.Message });
        }

        [HttpPost]
        public async Task<IActionResult> BatchDownload([FromBody] List<int> fileIds)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            try
            {
                var zipBytes = await _fileService.BatchDownloadAsync(fileIds, userId);
                return File(zipBytes, "application/zip", $"files_{DateTime.Now:yyyyMMddHHmmss}.zip");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost]
        public async Task<IActionResult> BatchDelete([FromBody] List<int> fileIds)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            int successCount = 0;
            int failCount = 0;

            foreach (var fileId in fileIds)
            {
                var result = await _fileService.DeleteFileAsync(fileId, userId, true);
                if (result.Success)
                    successCount++;
                else
                    failCount++;
            }

            return Json(new { success = true, successCount = successCount, failCount = failCount });
        }

        [HttpPost]
        public async Task<IActionResult> BatchMove([FromBody] BatchMoveRequest request)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            int successCount = 0;
            int failCount = 0;

            foreach (var fileId in request.FileIds)
            {
                var result = await _fileService.MoveFileAsync(fileId, request.TargetFolderId, userId);
                if (result.Success)
                    successCount++;
                else
                    failCount++;
            }

            return Json(new { success = true, successCount = successCount, failCount = failCount });
        }

        [HttpGet]
        public async Task<IActionResult> Preview(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return RedirectToAction("Login", "Account");

            var file = await _context.Files
                .FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);

            if (file == null)
                return NotFound();

            var hasPermission = await _permissionService.CheckPermissionAsync(file.FolderId, userId, PermissionType.ViewOnly, true);
            if (!hasPermission)
                return Forbid();

            // 检查文件类型是否支持预览
            var previewableTypes = new[] { "image/", "text/", "application/pdf" };
            var isPreviewable = previewableTypes.Any(t => file.ContentType?.StartsWith(t) == true);

            if (!isPreviewable)
                return BadRequest("该文件类型不支持预览");

            var fileBytes = await _fileService.DownloadFileAsync(id, userId);

            return File(fileBytes, file.ContentType);
        }

        [HttpGet]
        public async Task<IActionResult> GetFileInfo(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == 0)
                return Json(new { success = false, message = "未登录" });

            var file = await _context.Files
                .Include(f => f.Folder)
                .Include(f => f.UploadedBy)
                .FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);

            if (file == null)
                return Json(new { success = false, message = "文件不存在" });

            var permission = await _permissionService.GetUserFilePermissionAsync(id, userId);

            return Json(new
            {
                success = true,
                file = new
                {
                    file.Id,
                    file.Name,
                    Size = FormatFileSize(file.Size),
                    file.ContentType,
                    UploadedAt = file.UploadedAt,
                    UploadedBy = file.UploadedBy?.Username,
                    FolderName = file.Folder?.Name,
                    Permission = permission.ToString(),
                    CanDownload = permission >= PermissionType.CanDownload,
                    CanEdit = permission >= PermissionType.CanEdit,
                    CanDelete = permission >= PermissionType.FullControl
                }
            });
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

    public class BatchMoveRequest
    {
        public List<int> FileIds { get; set; } = new List<int>();
        public int TargetFolderId { get; set; }
    }
}