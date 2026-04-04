using CandyPlayer.Data;
using CandyPlayer.Models;
using Microsoft.EntityFrameworkCore;

namespace CandyPlayer.Services
{
    public class MediaService
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MediaService> _logger;

        public MediaService(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<MediaService> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<List<MediaFile>> GetFilesByTypeAsync(MediaType mediaType, int page, int pageSize, string? searchKeyword = null)
        {
            var query = _context.MediaFiles.Where(m => m.MediaType == mediaType);

            if (!string.IsNullOrWhiteSpace(searchKeyword))
            {
                query = query.Where(m => m.FileName.Contains(searchKeyword));
            }

            return await query
                .OrderByDescending(m => m.AddedTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<int> GetFilesCountByTypeAsync(MediaType mediaType, string? searchKeyword = null)
        {
            var query = _context.MediaFiles.Where(m => m.MediaType == mediaType);

            if (!string.IsNullOrWhiteSpace(searchKeyword))
            {
                query = query.Where(m => m.FileName.Contains(searchKeyword));
            }

            return await query.CountAsync();
        }

        public async Task<MediaFile?> GetFileByIdAsync(int fileId)
        {
            return await _context.MediaFiles.FindAsync(fileId);
        }

        public async Task<List<MediaFile>> GetTopPlayedFilesAsync(int count)
        {
            return await _context.MediaFiles
                .OrderByDescending(m => m.PlayCount)
                .Take(count)
                .ToListAsync();
        }

        public async Task<List<MediaFile>> GetRecentFilesAsync(int count)
        {
            return await _context.MediaFiles
                .OrderByDescending(m => m.AddedTime)
                .Take(count)
                .ToListAsync();
        }

        public async Task<Dictionary<MediaType, int>> GetFileStatisticsAsync()
        {
            var stats = new Dictionary<MediaType, int>();
            var files = await _context.MediaFiles.ToListAsync();

            stats[MediaType.Book] = files.Count(f => f.MediaType == MediaType.Book);
            stats[MediaType.Music] = files.Count(f => f.MediaType == MediaType.Music);
            stats[MediaType.Video] = files.Count(f => f.MediaType == MediaType.Video);

            return stats;
        }

        public string GetMediaPath()
        {
            return _configuration["AppSettings:MediaPath"] ?? "E:\\CandyPlayer";
        }

        public string GetBooksPath()
        {
            return _configuration["AppSettings:BooksPath"] ?? "E:\\CandyPlayer\\Books";
        }

        public string GetMusicPath()
        {
            return _configuration["AppSettings:MusicPath"] ?? "E:\\CandyPlayer\\Music";
        }

        public string GetVideosPath()
        {
            return _configuration["AppSettings:VideosPath"] ?? "E:\\CandyPlayer\\Videos";
        }

        public string GetContentType(string extension)
        {
            return extension.ToLower() switch
            {
                ".mp4" => "video/mp4",
                ".avi" => "video/x-msvideo",
                ".mkv" => "video/x-matroska",
                ".mov" => "video/quicktime",
                ".webm" => "video/webm",
                ".mp3" => "audio/mpeg",
                ".wav" => "audio/wav",
                ".flac" => "audio/flac",
                ".m4a" => "audio/mp4",
                ".pdf" => "application/pdf",
                ".txt" => "text/plain",
                _ => "application/octet-stream"
            };
        }

        public bool IsValidFileType(string fileName, MediaType mediaType)
        {
            var extension = Path.GetExtension(fileName).ToLower();
            return mediaType switch
            {
                MediaType.Book => extension == ".pdf" || extension == ".txt",
                MediaType.Music => extension == ".mp3" || extension == ".wav" || extension == ".flac" || extension == ".m4a",
                MediaType.Video => extension == ".mp4" || extension == ".avi" || extension == ".mkv" || extension == ".mov",
                _ => false
            };
        }
    }
}