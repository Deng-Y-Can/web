using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CandyPlayer.Data;
using CandyPlayer.Models;
using CandyPlayer.Models.ViewModel;
using CandyPlayer.Services;
using System.Security.Claims;
using CandyPlayer;
using Microsoft.AspNetCore.Mvc.Formatters;
using MediaType = CandyPlayer.Models.MediaType;

namespace CandyPlayer.Controllers
{
    [Authorize]
    public class AdminController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly PasswordService _passwordService;
        private readonly FileScannerService _fileScannerService;
        private readonly ILogger<AdminController> _logger;

        public AdminController(
            ApplicationDbContext context,
            PasswordService passwordService,
            FileScannerService fileScannerService,
            ILogger<AdminController> logger)
        {
            _context = context;
            _passwordService = passwordService;
            _fileScannerService = fileScannerService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var stats = new
            {
                TotalUsers = await _context.Users.CountAsync(),
                TotalFiles = await _context.MediaFiles.CountAsync(),
                Books = await _context.MediaFiles.CountAsync(m => m.MediaType == MediaType.Book),
                Music = await _context.MediaFiles.CountAsync(m => m.MediaType == MediaType.Music),
                Videos = await _context.MediaFiles.CountAsync(m => m.MediaType == MediaType.Video)
            };

            ViewBag.Stats = stats;
            return View();
        }

        [HttpGet]
        public async Task<IActionResult> Users(int page = 1, string search = "")
        {
            var pageSize = 20;
            var query = _context.Users.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(u => u.Username.Contains(search));
            }

            var totalCount = await query.CountAsync();
            var users = await query
                .OrderByDescending(u => u.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            ViewBag.CurrentPage = page;
            ViewBag.TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
            ViewBag.SearchKeyword = search;

            return View(users);
        }

        [HttpGet]
        public IActionResult AddUser()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AddUser(AddUserViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == model.Username);

            if (existingUser != null)
            {
                ModelState.AddModelError("Username", "用户名已存在");
                return View(model);
            }

            var user = new User
            {
                Username = model.Username,
                PasswordHash = _passwordService.HashPassword(model.Password),
                Role = model.Role,
                CreatedAt = DateTime.Now
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = "用户添加成功";
            return RedirectToAction("Users");
        }

        [HttpGet]
        public async Task<IActionResult> EditUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            return View(user);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> EditUser(int id, string username, string password, string role)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            if (!string.IsNullOrWhiteSpace(username) && username != user.Username)
            {
                var existingUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.Username == username && u.UserId != id);
                if (existingUser != null)
                {
                    TempData["ErrorMessage"] = "用户名已存在";
                    return RedirectToAction("EditUser", new { id });
                }
                user.Username = username;
            }

            if (!string.IsNullOrWhiteSpace(password))
            {
                user.PasswordHash = _passwordService.HashPassword(password);
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                user.Role = Enum.Parse<UserRole>(role);
            }

            await _context.SaveChangesAsync();
            TempData["SuccessMessage"] = "用户信息更新成功";
            return RedirectToAction("Users");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return Json(new { success = false, message = "用户不存在" });
            }

            var adminCount = await _context.Users.CountAsync(u => u.Role == UserRole.Admin);
            if (user.Role == UserRole.Admin && adminCount <= 1)
            {
                return Json(new { success = false, message = "不能删除最后一个管理员账号" });
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Json(new { success = true, message = "删除成功" });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RefreshFiles()
        {
            try
            {
                await _fileScannerService.ScanAllFilesAsync();
                return Json(new { success = true, message = "文件刷新成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "文件刷新失败");
                return Json(new { success = false, message = "文件刷新失败" });
            }
        }

        [HttpGet]
        public async Task<IActionResult> Logs(int page = 1)
        {
            var pageSize = 50;
            var totalCount = await _context.OperationLogs.CountAsync();
            var logs = await _context.OperationLogs
                .OrderByDescending(l => l.OperationTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            ViewBag.CurrentPage = page;
            ViewBag.TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            return View(logs);
        }
    }
}