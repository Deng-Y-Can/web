using CandyPlayer.Data;
using CandyPlayer.Models;
using CandyPlayer.Models.ViewModel;
using CandyPlayer.Services;
using CandyPlayer;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CandyPlayer.Controllers
{
    [Authorize]
    public class ProfileController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly PasswordService _passwordService;
        private readonly ILogger<ProfileController> _logger;

        public ProfileController(
            ApplicationDbContext context,
            PasswordService passwordService,
            ILogger<ProfileController> logger)
        {
            _context = context;
            _passwordService = passwordService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var userIdInt = int.Parse(userId);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userIdInt);
            if (user == null)
            {
                return NotFound();
            }

            var recentHistory = await _context.PlayHistories
                .Where(h => h.UserId == userIdInt)
                .Include(h => h.MediaFile)
                .OrderByDescending(h => h.PlayTime)
                .Take(20)
                .ToListAsync();

            var favorites = await _context.Favorites
                .Where(f => f.UserId == userIdInt)
                .Include(f => f.MediaFile)
                .OrderByDescending(f => f.CreatedAt)
                .Take(20)
                .Select(f => f.MediaFile)
                .Where(m => m != null)
                .ToListAsync();

            var playlists = await _context.Playlists
                .Where(p => p.UserId == userIdInt)
                .Include(p => p.PlaylistItems)
                .OrderByDescending(p => p.CreatedAt)
                .Take(10)
                .ToListAsync();

            var viewModel = new UserProfileViewModel
            {
                UserId = user.UserId,
                Username = user.Username,
                Role = user.Role.ToString(),
                CreatedAt = user.CreatedAt,
                LastLoginTime = user.LastLoginTime,
                RecentPlayHistory = recentHistory,
                Favorites = favorites ?? new List<MediaFile>(),
                Playlists = playlists
            };

            return View(viewModel);
        }

        [HttpGet]
        public IActionResult ChangePassword()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ChangePassword(ChangePasswordViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var user = await _context.Users.FindAsync(int.Parse(userId));
            if (user == null)
            {
                return NotFound();
            }

            if (!_passwordService.VerifyPassword(model.OldPassword, user.PasswordHash))
            {
                ModelState.AddModelError("OldPassword", "原密码错误");
                return View(model);
            }

            user.PasswordHash = _passwordService.HashPassword(model.NewPassword);
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = "密码修改成功，请重新登录";

            await HttpContext.SignOutAsync();
            HttpContext.Session.Clear();

            return RedirectToAction("Login", "Account");
        }

        [HttpGet]
        public async Task<IActionResult> History()
        {
            var userId = User.FindFirst("UserId")?.Value ?? HttpContext.Session.GetInt32("UserId")?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login", "Account");
            }

            var history = await _context.PlayHistories
                .Where(h => h.UserId == int.Parse(userId))
                .Include(h => h.MediaFile)
                .OrderByDescending(h => h.PlayTime)
                .ToListAsync();

            return View(history);
        }
    }
}