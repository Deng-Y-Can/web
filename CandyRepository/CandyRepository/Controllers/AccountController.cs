using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;

namespace CandyRepository.Controllers
{
    public class AccountController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogService _logService;

        public AccountController(ApplicationDbContext context, ILogService logService)
        {
            _context = context;
            _logService = logService;
        }

        [HttpGet]
        public IActionResult Login()
        {
            if (HttpContext.Session.GetInt32("UserId") != null)
            {
                return RedirectToAction("Index", "Home");
            }
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Login(string username, string password)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

            if (user != null && VerifyPassword(password, user.PasswordHash, user.Salt))
            {
                HttpContext.Session.SetInt32("UserId", user.Id);
                HttpContext.Session.SetString("Username", user.Username);
                HttpContext.Session.SetString("IsAdmin", user.IsAdmin.ToString());

                // 更新最后登录信息
                user.LastLoginAt = DateTime.UtcNow;
                user.LastLoginIP = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _context.SaveChangesAsync();

                // 记录登录日志
                await _logService.LogAsync(user.Id, OperationType.Login,
                    "用户登录",
                    $"IP: {HttpContext.Connection.RemoteIpAddress}");

                return RedirectToAction("Index", "Home");
            }

            ViewBag.Error = "用户名或密码错误";
            return View();
        }

        // Controllers/AccountController.cs
        [HttpPost]
        public async Task<IActionResult> Logout()
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId.HasValue)
            {
                await _logService.LogAsync(userId.Value, OperationType.Logout, "用户登出", "");
            }

            HttpContext.Session.Clear();
            return RedirectToAction("Login");
        }

        [HttpPost]
        public async Task<IActionResult> ChangePassword(int userId, string oldPassword, string newPassword)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            if (currentUserId != userId && !IsAdmin())
            {
                return Json(new { success = false, message = "无权限修改他人密码" });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return Json(new { success = false, message = "用户不存在" });
            }

            if (!VerifyPassword(oldPassword, user.PasswordHash, user.Salt))
            {
                return Json(new { success = false, message = "原密码错误" });
            }

            var (hash, salt) = HashPassword(newPassword);
            user.PasswordHash = hash;
            user.Salt = salt;
            await _context.SaveChangesAsync();

            await _logService.LogAsync(currentUserId.Value, OperationType.UserUpdate,
                $"修改密码",
                $"用户: {user.Username}");

            return Json(new { success = true, message = "密码修改成功" });
        }

        private bool VerifyPassword(string password, string hash, string salt)
        {
            using (var sha256 = SHA256.Create())
            {
                var saltedPassword = password + salt;
                var bytes = Encoding.UTF8.GetBytes(saltedPassword);
                var computedHash = sha256.ComputeHash(bytes);
                var computedHashString = Convert.ToBase64String(computedHash);
                return computedHashString == hash;
            }
        }

        private (string hash, string salt) HashPassword(string password)
        {
            var salt = Guid.NewGuid().ToString();
            using (var sha256 = SHA256.Create())
            {
                var saltedPassword = password + salt;
                var bytes = Encoding.UTF8.GetBytes(saltedPassword);
                var hash = sha256.ComputeHash(bytes);
                return (Convert.ToBase64String(hash), salt);
            }
        }

        private bool IsAdmin()
        {
            return HttpContext.Session.GetString("IsAdmin") == "True";
        }

        // 初始化默认用户
        public async Task<IActionResult> InitializeDefaultUsers()
        {
            // 管理员
            if (!await _context.Users.AnyAsync(u => u.Username == "zoe"))
            {
                var (adminHash, adminSalt) = HashPassword("candy");
                var admin = new User
                {
                    Username = "zoe",
                    PasswordHash = adminHash,
                    Salt = adminSalt,
                    IsAdmin = true,
                    IsActive = true
                };
                _context.Users.Add(admin);
            }

            // 普通用户 user1-user10
            for (int i = 1; i <= 10; i++)
            {
                var username = $"user{i}";
                if (!await _context.Users.AnyAsync(u => u.Username == username))
                {
                    var (userHash, userSalt) = HashPassword("123456");
                    var user = new User
                    {
                        Username = username,
                        PasswordHash = userHash,
                        Salt = userSalt,
                        IsAdmin = false,
                        IsActive = true
                    };
                    _context.Users.Add(user);
                }
            }

            await _context.SaveChangesAsync();
            return Ok("默认用户初始化完成");
        }


    }
}