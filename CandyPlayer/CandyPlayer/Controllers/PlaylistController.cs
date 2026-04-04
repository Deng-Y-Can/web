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
    public class PlaylistController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PlaylistController> _logger;

        public PlaylistController(ApplicationDbContext context, ILogger<PlaylistController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: /Playlist/Books
        [HttpGet]
        public async Task<IActionResult> Books()
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var playlists = await _context.Playlists
                .Where(p => p.UserId == int.Parse(userId) && p.Type == PlaylistType.Book)
                .Include(p => p.PlaylistItems)
                    .ThenInclude(pi => pi.MediaFile)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            ViewBag.Title = "我的阅读列表";
            ViewBag.Type = "Book";
            ViewBag.TypeIcon = "fa-book";
            return View("Index", playlists);
        }

        // GET: /Playlist/Music
        [HttpGet]
        public async Task<IActionResult> Music()
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var playlists = await _context.Playlists
                .Where(p => p.UserId == int.Parse(userId) && p.Type == PlaylistType.Music)
                .Include(p => p.PlaylistItems)
                    .ThenInclude(pi => pi.MediaFile)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            ViewBag.Title = "我的播放列表";
            ViewBag.Type = "Music";
            ViewBag.TypeIcon = "fa-music";
            return View("Index", playlists);
        }

        // GET: /Playlist/Videos
        [HttpGet]
        public async Task<IActionResult> Videos()
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var playlists = await _context.Playlists
                .Where(p => p.UserId == int.Parse(userId) && p.Type == PlaylistType.Video)
                .Include(p => p.PlaylistItems)
                    .ThenInclude(pi => pi.MediaFile)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            ViewBag.Title = "我的观看列表";
            ViewBag.Type = "Video";
            ViewBag.TypeIcon = "fa-video";
            return View("Index", playlists);
        }

        // GET: /Playlist/Details/{id}
        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var playlist = await _context.Playlists
                .Where(p => p.PlaylistId == id && p.UserId == int.Parse(userId))
                .Include(p => p.PlaylistItems)
                    .ThenInclude(pi => pi.MediaFile)
                .FirstOrDefaultAsync();

            if (playlist == null)
            {
                return NotFound();
            }

            return View(playlist);
        }

        // POST: /Playlist/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(string name, string description, int type)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                if (string.IsNullOrWhiteSpace(name))
                {
                    return Json(new { success = false, message = "列表名称不能为空" });
                }

                var playlist = new Playlist
                {
                    PlaylistName = name.Trim(),
                    Description = description ?? string.Empty,
                    Type = (PlaylistType)type,
                    UserId = int.Parse(userId),
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                _context.Playlists.Add(playlist);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"用户 {userId} 创建列表: {name}");
                return Json(new { success = true, playlistId = playlist.PlaylistId, message = "创建成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "创建列表失败");
                return Json(new { success = false, message = "创建失败: " + ex.Message });
            }
        }

        // POST: /Playlist/Update
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Update(int playlistId, string name, string description)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                if (string.IsNullOrWhiteSpace(name))
                {
                    return Json(new { success = false, message = "列表名称不能为空" });
                }

                var playlist = await _context.Playlists
                    .FirstOrDefaultAsync(p => p.PlaylistId == playlistId && p.UserId == int.Parse(userId));

                if (playlist == null)
                {
                    return Json(new { success = false, message = "列表不存在" });
                }

                playlist.PlaylistName = name.Trim();
                playlist.Description = description ?? string.Empty;
                playlist.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();

                return Json(new { success = true, message = "更新成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新列表失败");
                return Json(new { success = false, message = "更新失败: " + ex.Message });
            }
        }

        // POST: /Playlist/Delete
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int playlistId)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                var playlist = await _context.Playlists
                    .FirstOrDefaultAsync(p => p.PlaylistId == playlistId && p.UserId == int.Parse(userId));

                if (playlist == null)
                {
                    return Json(new { success = false, message = "列表不存在或无权限" });
                }

                _context.Playlists.Remove(playlist);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"用户 {userId} 删除列表: {playlist.PlaylistName}");
                return Json(new { success = true, message = "删除成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "删除列表失败");
                return Json(new { success = false, message = "删除失败: " + ex.Message });
            }
        }

        // 确保 PlaylistController 中的 AddItem 方法正确
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AddItem(int playlistId, int fileId, string? note)
        {
            try
            {
                _logger.LogInformation($"添加项目到列表: playlistId={playlistId}, fileId={fileId}");

                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                var playlist = await _context.Playlists
                    .FirstOrDefaultAsync(p => p.PlaylistId == playlistId && p.UserId == int.Parse(userId));

                if (playlist == null)
                {
                    return Json(new { success = false, message = "列表不存在或无权限" });
                }

                var file = await _context.MediaFiles.FindAsync(fileId);
                if (file == null)
                {
                    return Json(new { success = false, message = "文件不存在" });
                }

                // 验证媒体类型匹配
                bool typeMatches = (playlist.Type == PlaylistType.Book && file.MediaType == MediaType.Book) ||
                                   (playlist.Type == PlaylistType.Music && file.MediaType == MediaType.Music) ||
                                   (playlist.Type == PlaylistType.Video && file.MediaType == MediaType.Video);

                if (!typeMatches)
                {
                    return Json(new { success = false, message = $"文件类型与列表类型不匹配，此列表只能添加{GetTypeName(playlist.Type)}" });
                }

                var exists = await _context.PlaylistItems
                    .AnyAsync(pi => pi.PlaylistId == playlistId && pi.MediaFileId == fileId);

                if (exists)
                {
                    return Json(new { success = false, message = "项目已在列表中" });
                }

                var maxOrder = await _context.PlaylistItems
                    .Where(pi => pi.PlaylistId == playlistId)
                    .MaxAsync(pi => (int?)pi.SortOrder) ?? 0;

                var playlistItem = new PlaylistItem
                {
                    PlaylistId = playlistId,
                    MediaFileId = fileId,
                    SortOrder = maxOrder + 1,
                    Note = note ?? string.Empty
                };

                _context.PlaylistItems.Add(playlistItem);
                playlist.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();

                _logger.LogInformation($"成功添加项目到列表: {playlist.PlaylistName}");
                return Json(new { success = true, message = "添加成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "添加项目失败");
                return Json(new { success = false, message = $"添加失败: {ex.Message}" });
            }
        }

        private string GetTypeName(PlaylistType type)
        {
            return type switch
            {
                PlaylistType.Book => "阅读列表",
                PlaylistType.Music => "播放列表",
                PlaylistType.Video => "观看列表",
                _ => "列表"
            };
        }

        // POST: /Playlist/RemoveItem
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RemoveItem(int playlistId, int fileId)
        {
            try
            {
                var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
                if (string.IsNullOrEmpty(userId))
                {
                    return Json(new { success = false, message = "请先登录" });
                }

                var playlistItem = await _context.PlaylistItems
                    .Include(pi => pi.Playlist)
                    .FirstOrDefaultAsync(pi => pi.PlaylistId == playlistId && pi.MediaFileId == fileId);

                if (playlistItem == null)
                {
                    return Json(new { success = false, message = "项目不在列表中" });
                }

                if (playlistItem.Playlist?.UserId != int.Parse(userId))
                {
                    return Json(new { success = false, message = "无权限操作" });
                }

                _context.PlaylistItems.Remove(playlistItem);

                if (playlistItem.Playlist != null)
                {
                    playlistItem.Playlist.UpdatedAt = DateTime.Now;
                }
                await _context.SaveChangesAsync();

                // 重新排序
                var items = await _context.PlaylistItems
                    .Where(pi => pi.PlaylistId == playlistId)
                    .OrderBy(pi => pi.SortOrder)
                    .ToListAsync();

                for (int i = 0; i < items.Count; i++)
                {
                    items[i].SortOrder = i;
                }
                await _context.SaveChangesAsync();

                return Json(new { success = true, message = "移除成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "移除项目失败");
                return Json(new { success = false, message = "移除失败: " + ex.Message });
            }
        }

        // GET: /Playlist/PlayAll/{id}
        [HttpGet]
        public async Task<IActionResult> PlayAll(int id)
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var playlist = await _context.Playlists
                .Where(p => p.PlaylistId == id && p.UserId == int.Parse(userId))
                .Include(p => p.PlaylistItems)
                    .ThenInclude(pi => pi.MediaFile)
                .FirstOrDefaultAsync();

            if (playlist == null)
            {
                return NotFound();
            }

            var items = playlist.PlaylistItems.OrderBy(i => i.SortOrder).ToList();
            if (!items.Any())
            {
                TempData["ErrorMessage"] = "列表为空";
                return RedirectToAction("Details", new { id = id });
            }

            var firstItem = items.First().MediaFile;
            if (firstItem != null)
            {
                return RedirectToAction("Play", "Media", new { id = firstItem.FileId });
            }

            return RedirectToAction("Details", new { id = id });
        }

        // 在 PlaylistController.cs 中添加获取用户列表的方法
        [HttpGet]
        public async Task<IActionResult> GetUserPlaylists(int type)
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Json(new List<object>());
            }

            var playlists = await _context.Playlists
                .Where(p => p.UserId == int.Parse(userId) && p.Type == (PlaylistType)type)
                .Select(p => new { p.PlaylistId, p.PlaylistName, p.Description })
                .OrderBy(p => p.PlaylistName)
                .ToListAsync();

            return Json(playlists);
        }
    }
}