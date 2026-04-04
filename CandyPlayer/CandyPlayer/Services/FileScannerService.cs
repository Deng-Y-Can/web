using CandyPlayer.Data;
using CandyPlayer.Models;
using Microsoft.EntityFrameworkCore;

namespace CandyPlayer.Services
{
    public class FileScannerService
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<FileScannerService> _logger;

        private static readonly HashSet<string> BookExtensions = new()
        { ".txt", ".pdf" };

        private static readonly HashSet<string> MusicExtensions = new()
        { ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg" };

        private static readonly HashSet<string> VideoExtensions = new()
        { ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm" };

        public FileScannerService(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<FileScannerService> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task ScanAllFilesAsync()
        {
            var mediaPath = _configuration["AppSettings:MediaPath"] ?? "D:\\CandyPlayer";
            if (!Directory.Exists(mediaPath))
            {
                _logger.LogWarning($"媒体文件夹不存在: {mediaPath}");
                return;
            }

            _logger.LogInformation("开始扫描文件...");
            var files = Directory.GetFiles(mediaPath, "*", SearchOption.AllDirectories);
            var existingFiles = await _context.MediaFiles.ToDictionaryAsync(f => f.FilePath);

            var newFiles = new List<MediaFile>();
            var updatedFiles = new List<MediaFile>();

            foreach (var filePath in files)
            {
                var fileInfo = new FileInfo(filePath);
                var extension = fileInfo.Extension.ToLower();
                var mediaType = GetMediaType(extension);

                if (mediaType == null) continue;

                if (existingFiles.TryGetValue(filePath, out var existingFile))
                {
                    if (existingFile.LastModifiedTime != fileInfo.LastWriteTime ||
                        existingFile.FileSize != fileInfo.Length)
                    {
                        existingFile.LastModifiedTime = fileInfo.LastWriteTime;
                        existingFile.FileSize = fileInfo.Length;
                        updatedFiles.Add(existingFile);
                    }
                    existingFiles.Remove(filePath);
                }
                else
                {
                    newFiles.Add(new MediaFile
                    {
                        FileName = fileInfo.Name,
                        FilePath = filePath,
                        MediaType = mediaType.Value,
                        FileExtension = extension.TrimStart('.'),
                        FileSize = fileInfo.Length,
                        LastModifiedTime = fileInfo.LastWriteTime,
                        AddedTime = DateTime.Now
                    });
                }
            }

            if (newFiles.Any())
            {
                await _context.MediaFiles.AddRangeAsync(newFiles);
                _logger.LogInformation($"新增文件: {newFiles.Count}");
            }

            if (updatedFiles.Any())
            {
                _context.MediaFiles.UpdateRange(updatedFiles);
                _logger.LogInformation($"更新文件: {updatedFiles.Count}");
            }

            if (existingFiles.Any())
            {
                _context.MediaFiles.RemoveRange(existingFiles.Values);
                _logger.LogInformation($"删除文件: {existingFiles.Count}");
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("文件扫描完成");
        }

        private MediaType? GetMediaType(string extension)
        {
            if (BookExtensions.Contains(extension))
                return MediaType.Book;
            if (MusicExtensions.Contains(extension))
                return MediaType.Music;
            if (VideoExtensions.Contains(extension))
                return MediaType.Video;
            return null;
        }
    }
}