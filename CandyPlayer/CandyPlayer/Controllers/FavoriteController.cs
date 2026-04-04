using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CandyPlayer.Data;
using CandyPlayer.Models;
using Microsoft.AspNetCore.Mvc.Formatters;
using MediaType = CandyPlayer.Models.MediaType;

namespace CandyPlayer.Controllers
{
    [Authorize]
    public class FavoriteController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FavoriteController> _logger;

        public FavoriteController(ApplicationDbContext context, ILogger<FavoriteController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Index(int? mediaType = null)
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var userIdInt = int.Parse(userId);

            var allFavorites = await _context.Favorites
                .Where(f => f.UserId == userIdInt)
                .Include(f => f.MediaFile)
                .ToListAsync();

            var filteredFavorites = allFavorites;
            if (mediaType.HasValue)
            {
                var mediaTypeEnum = (MediaType)mediaType.Value;
                filteredFavorites = allFavorites
                    .Where(f => f.MediaFile != null && f.MediaFile.MediaType == mediaTypeEnum)
                    .ToList();
            }

            var favorites = filteredFavorites
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => f.MediaFile)
                .Where(m => m != null)
                .ToList();

            ViewBag.BookCount = allFavorites.Count(f => f.MediaFile?.MediaType == MediaType.Book);
            ViewBag.MusicCount = allFavorites.Count(f => f.MediaFile?.MediaType == MediaType.Music);
            ViewBag.VideoCount = allFavorites.Count(f => f.MediaFile?.MediaType == MediaType.Video);
            ViewBag.SelectedType = mediaType;

            return View(favorites);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Add(int fileId)
        {
            try
            {
                _logger.LogInformation($"收藏请求收到，文件ID: {fileId}");

                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                var userIdInt = int.Parse(userId);

                var file = await _context.MediaFiles.FindAsync(fileId);
                if (file == null)
                {
                    return Json(new { success = false, message = "文件不存在" });
                }

                var exists = await _context.Favorites
                    .AnyAsync(f => f.UserId == userIdInt && f.MediaFileId == fileId);

                if (exists)
                {
                    return Json(new { success = false, message = "已经收藏过了", isFavorited = true });
                }

                var favorite = new Favorite
                {
                    UserId = userIdInt,
                    MediaFileId = fileId,
                    CreatedAt = DateTime.Now
                };

                _context.Favorites.Add(favorite);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"用户 {userId} 收藏了文件: {file.FileName}");
                return Json(new { success = true, message = "收藏成功", isFavorited = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "添加收藏失败");
                return Json(new { success = false, message = $"收藏失败: {ex.Message}" });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Remove(int fileId)
        {
            try
            {
                _logger.LogInformation($"取消收藏请求收到，文件ID: {fileId}");

                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                var favorite = await _context.Favorites
                    .FirstOrDefaultAsync(f => f.UserId == int.Parse(userId) && f.MediaFileId == fileId);

                if (favorite == null)
                {
                    return Json(new { success = false, message = "收藏不存在", isFavorited = false });
                }

                _context.Favorites.Remove(favorite);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"用户 {userId} 取消收藏文件: {fileId}");
                return Json(new { success = true, message = "取消收藏成功", isFavorited = false });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "取消收藏失败");
                return Json(new { success = false, message = $"取消收藏失败: {ex.Message}" });
            }
        }

        [HttpGet]
        public async Task<IActionResult> Check(int fileId)
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Json(new { isFavorited = false });
            }

            var isFavorited = await _context.Favorites
                .AnyAsync(f => f.UserId == int.Parse(userId) && f.MediaFileId == fileId);

            return Json(new { isFavorited = isFavorited });
        }
    }
}