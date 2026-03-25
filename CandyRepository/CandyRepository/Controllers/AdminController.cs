using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;
using System.Text;

namespace CandyRepository.Controllers
{
    public class AdminController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogService _logService;
        private readonly IConfiguration _configuration;

        public AdminController(
            ApplicationDbContext context,
            ILogService logService,
            IConfiguration configuration)
        {
            _context = context;
            _logService = logService;
            _configuration = configuration;
        }

        private bool IsAdmin()
        {
            return HttpContext.Session.GetString("IsAdmin") == "True";
        }

        private int GetCurrentUserId()
        {
            return HttpContext.Session.GetInt32("UserId") ?? 0;
        }

        private (string hash, string salt) HashPassword(string password)
        {
            var salt = Guid.NewGuid().ToString();
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var saltedPassword = password + salt;
                var bytes = Encoding.UTF8.GetBytes(saltedPassword);
                var hash = sha256.ComputeHash(bytes);
                return (Convert.ToBase64String(hash), salt);
            }
        }

        // 管理后台首页
        [HttpGet]
        public async Task<IActionResult> Dashboard()
        {
            if (!IsAdmin())
                return RedirectToAction("Index", "Home");

            var stats = new
            {
                TotalUsers = await _context.Users.CountAsync(),
                ActiveUsers = await _context.Users.CountAsync(u => u.IsActive),
                TotalFiles = await _context.Files.CountAsync(f => !f.IsDeleted),
                TotalFolders = await _context.Folders.CountAsync(f => !f.IsDeleted),
                TotalStorage = await _context.Files.SumAsync(f => f.Size),
                TodayOperations = await _context.OperationLogs.CountAsync(l => l.OperationTime >= DateTime.UtcNow.Date)
            };

            var recentLogs = await _context.OperationLogs
                .Include(l => l.User)
                .OrderByDescending(l => l.OperationTime)
                .Take(20)
                .ToListAsync();

            ViewBag.Stats = stats;
            ViewBag.RecentLogs = recentLogs;

            return View();
        }

        // 用户管理页面
        [HttpGet]
        public async Task<IActionResult> Users(int page = 1, string? search = null)
        {
            if (!IsAdmin())
                return RedirectToAction("Index", "Home");

            int pageSize = 20;
            var query = _context.Users.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(u => u.Username.Contains(search));
            }

            var totalUsers = await query.CountAsync();
            var users = await query
                .OrderBy(u => u.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            ViewBag.Users = users;
            ViewBag.TotalUsers = totalUsers;
            ViewBag.CurrentPage = page;
            ViewBag.TotalPages = (int)Math.Ceiling(totalUsers / (double)pageSize);
            ViewBag.Search = search;

            return View();
        }
        // 删除用户
        [HttpPost]
        public async Task<IActionResult> DeleteUser(int userId)
        {
            if (!IsAdmin())
                return Json(new { success = false, message = "无权限" });

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return Json(new { success = false, message = "用户不存在" });

            if (user.IsAdmin)
                return Json(new { success = false, message = "不能删除管理员账户" });

            // 检查用户是否有文件或文件夹
            var hasFiles = await _context.Files.AnyAsync(f => f.UploadedById == userId && !f.IsDeleted);
            var hasFolders = await _context.Folders.AnyAsync(f => f.OwnerId == userId && !f.IsDeleted);

            if (hasFiles || hasFolders)
            {
                return Json(new { success = false, message = "该用户有文件或文件夹，请先删除或转移后再删除用户" });
            }

            // 删除用户相关的权限记录
            var folderPermissions = await _context.FolderPermissions.Where(fp => fp.UserId == userId).ToListAsync();
            var filePermissions = await _context.FilePermissions.Where(fp => fp.UserId == userId).ToListAsync();
            _context.FolderPermissions.RemoveRange(folderPermissions);
            _context.FilePermissions.RemoveRange(filePermissions);

            // 删除用户的操作日志
            var logs = await _context.OperationLogs.Where(l => l.UserId == userId).ToListAsync();
            _context.OperationLogs.RemoveRange(logs);

            // 删除用户
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            await _logService.LogAsync(GetCurrentUserId(), OperationType.UserDelete,
                $"删除用户", $"用户名: {user.Username}");

            return Json(new { success = true, message = "用户删除成功" });
        }
        // 重置用户密码
        [HttpPost]
        public async Task<IActionResult> ResetPassword(int userId)
        {
            if (!IsAdmin())
                return Json(new { success = false, message = "无权限" });

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return Json(new { success = false, message = "用户不存在" });

            var (hash, salt) = HashPassword("123456");
            user.PasswordHash = hash;
            user.Salt = salt;
            await _context.SaveChangesAsync();

            await _logService.LogAsync(GetCurrentUserId(), OperationType.UserUpdate,
                $"重置用户密码", $"用户: {user.Username}");

            return Json(new { success = true, message = "密码已重置为 123456" });
        }

        // 切换用户状态（启用/禁用）
        [HttpPost]
        public async Task<IActionResult> ToggleUserStatus(int userId)
        {
            if (!IsAdmin())
                return Json(new { success = false, message = "无权限" });

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return Json(new { success = false, message = "用户不存在" });

            if (user.IsAdmin)
                return Json(new { success = false, message = "不能禁用管理员账户" });

            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync();

            await _logService.LogAsync(GetCurrentUserId(), OperationType.UserUpdate,
                $"{(user.IsActive ? "启用" : "禁用")}用户", $"用户: {user.Username}");

            return Json(new { success = true, message = $"用户已{(user.IsActive ? "启用" : "禁用")}" });
        }

        // 操作日志页面
        [HttpGet]
        public async Task<IActionResult> Logs(DateTime? startDate, DateTime? endDate, OperationType? operationType, int? userId, int page = 1)
        {
            if (!IsAdmin())
                return RedirectToAction("Index", "Home");

            int pageSize = 50;
            var query = _context.OperationLogs
                .Include(l => l.User)
                .AsQueryable();

            if (startDate.HasValue)
                query = query.Where(l => l.OperationTime >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.OperationTime <= endDate.Value);

            if (operationType.HasValue)
                query = query.Where(l => l.OperationType == operationType.Value);

            if (userId.HasValue)
                query = query.Where(l => l.UserId == userId.Value);

            var totalLogs = await query.CountAsync();
            var logs = await query
                .OrderByDescending(l => l.OperationTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var users = await _context.Users
                .Select(u => new { u.Id, u.Username })
                .ToListAsync();

            ViewBag.Logs = logs;
            ViewBag.TotalLogs = totalLogs;
            ViewBag.CurrentPage = page;
            ViewBag.TotalPages = (int)Math.Ceiling(totalLogs / (double)pageSize);
            ViewBag.StartDate = startDate;
            ViewBag.EndDate = endDate;
            ViewBag.OperationType = operationType;
            ViewBag.SelectedUserId = userId;
            ViewBag.Users = users;

            return View();
        }

        // 导出日志
        [HttpGet]
        public async Task<IActionResult> ExportLogs(DateTime? startDate, DateTime? endDate, OperationType? operationType, int? userId)
        {
            if (!IsAdmin())
                return Forbid();

            var query = _context.OperationLogs
                .Include(l => l.User)
                .AsQueryable();

            if (startDate.HasValue)
                query = query.Where(l => l.OperationTime >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.OperationTime <= endDate.Value);

            if (operationType.HasValue)
                query = query.Where(l => l.OperationType == operationType.Value);

            if (userId.HasValue)
                query = query.Where(l => l.UserId == userId.Value);

            var logs = await query
                .OrderByDescending(l => l.OperationTime)
                .Take(10000)
                .ToListAsync();

            var csv = new StringBuilder();
            csv.AppendLine("操作时间,用户,操作类型,操作内容,详情,IP地址");

            foreach (var log in logs)
            {
                csv.AppendLine($"\"{log.OperationTime:yyyy-MM-dd HH:mm:ss}\",\"{log.User?.Username}\",\"{log.OperationType}\",\"{log.TargetPath}\",\"{log.Details?.Replace("\"", "\"\"")}\",\"{log.IPAddress}\"");
            }

            var bytes = Encoding.UTF8.GetBytes(csv.ToString());
            var fileName = $"logs_{DateTime.Now:yyyyMMddHHmmss}.csv";

            return File(bytes, "text/csv", fileName);
        }

        // 清理旧日志
        [HttpPost]
        public async Task<IActionResult> CleanLogs()
        {
            if (!IsAdmin())
                return Json(new { success = false, message = "无权限" });

            var retentionDays = _configuration.GetValue<int>("Storage:LogRetentionDays", 90);
            var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);

            var oldLogs = await _context.OperationLogs
                .Where(l => l.OperationTime < cutoffDate)
                .ToListAsync();

            _context.OperationLogs.RemoveRange(oldLogs);
            await _context.SaveChangesAsync();

            await _logService.LogAsync(GetCurrentUserId(), OperationType.UserUpdate,
                "清理操作日志", $"清理了 {oldLogs.Count} 条 {retentionDays} 天前的日志");

            return Json(new { success = true, message = $"已清理 {oldLogs.Count} 条 {retentionDays} 天前的日志" });
        }

        // 系统统计页面
        [HttpGet]
        public async Task<IActionResult> Statistics()
        {
            if (!IsAdmin())
                return RedirectToAction("Index", "Home");

            var filesByType = await _context.Files
                .Where(f => !f.IsDeleted)
                .GroupBy(f => f.ContentType ?? "未知")
                .Select(g => new FileTypeStat { Type = g.Key, Count = g.Count() })
                .Take(10)
                .ToListAsync();

            var operationsByDay = await _context.OperationLogs
                .Where(l => l.OperationTime >= DateTime.UtcNow.AddDays(-30))
                .GroupBy(l => l.OperationTime.Date)
                .Select(g => new OperationDayStat { Date = g.Key, Count = g.Count() })
                .OrderBy(g => g.Date)
                .ToListAsync();

            var stats = new
            {
                TotalUsers = await _context.Users.CountAsync(),
                ActiveUsers = await _context.Users.CountAsync(u => u.IsActive),
                TotalFiles = await _context.Files.CountAsync(f => !f.IsDeleted),
                TotalFolders = await _context.Folders.CountAsync(f => !f.IsDeleted),
                TotalStorage = await _context.Files.SumAsync(f => f.Size),
                TodayOperations = await _context.OperationLogs.CountAsync(l => l.OperationTime >= DateTime.UtcNow.Date),
                WeekOperations = await _context.OperationLogs.CountAsync(l => l.OperationTime >= DateTime.UtcNow.AddDays(-7)),
                MonthOperations = await _context.OperationLogs.CountAsync(l => l.OperationTime >= DateTime.UtcNow.AddDays(-30)),
                TotalOperations = await _context.OperationLogs.CountAsync(),
                FilesByType = filesByType,
                OperationsByDay = operationsByDay
            };

            ViewBag.Stats = stats;
            return View();
        }

        // 清理回收站
        [HttpPost]
        public async Task<IActionResult> CleanRecycleBin()
        {
            if (!IsAdmin())
                return Json(new { success = false, message = "无权限" });

            var retentionDays = _configuration.GetValue<int>("Storage:RecycleBinRetentionDays", 30);
            var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);

            var expiredItems = await _context.RecycleBin
                .Where(r => r.ExpiresAt < cutoffDate)
                .ToListAsync();

            int deletedCount = 0;
            foreach (var item in expiredItems)
            {
                if (item.ItemType == DeletedItemType.File)
                {
                    var file = await _context.Files.FindAsync(item.ItemId);
                    if (file != null)
                    {
                        var physicalPath = Path.Combine(_configuration["Storage:RootPath"] ?? @"E:\CandyRepository\", file.PhysicalPath);
                        if (System.IO.File.Exists(physicalPath))
                        {
                            System.IO.File.Delete(physicalPath);
                        }
                        _context.Files.Remove(file);
                        deletedCount++;
                    }
                }
                else if (item.ItemType == DeletedItemType.Folder)
                {
                    var folder = await _context.Folders.FindAsync(item.ItemId);
                    if (folder != null)
                    {
                        _context.Folders.Remove(folder);
                        deletedCount++;
                    }
                }
            }

            _context.RecycleBin.RemoveRange(expiredItems);
            await _context.SaveChangesAsync();

            await _logService.LogAsync(GetCurrentUserId(), OperationType.UserUpdate,
                "清理回收站", $"清理了 {expiredItems.Count} 个过期项目");

            return Json(new { success = true, message = $"已清理 {expiredItems.Count} 个过期项目" });
        }

        // 添加用户页面
        [HttpGet]
        public IActionResult CreateUser()
        {
            if (!IsAdmin())
                return RedirectToAction("Index", "Home");

            return View();
        }

        // 添加用户
        [HttpPost]
        public async Task<IActionResult> CreateUser(string username, string password, bool isAdmin = false)
        {
            if (!IsAdmin())
                return Json(new { success = false, message = "无权限" });

            // 检查用户名是否已存在
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
            if (existingUser != null)
                return Json(new { success = false, message = "用户名已存在" });

            // 检查密码长度
            if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
                return Json(new { success = false, message = "密码长度至少为6位" });

            var (hash, salt) = HashPassword(password);

            var user = new User
            {
                Username = username,
                PasswordHash = hash,
                Salt = salt,
                IsAdmin = isAdmin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await _logService.LogAsync(GetCurrentUserId(), OperationType.UserCreate,
                $"添加用户", $"用户名: {username}, 角色: {(isAdmin ? "管理员" : "普通用户")}");

            return Json(new { success = true, message = "用户添加成功" });
        }
    }

    // 辅助类
    public class FileTypeStat
    {
        public string? Type { get; set; }
        public int Count { get; set; }
    }

    public class OperationDayStat
    {
        public DateTime Date { get; set; }
        public int Count { get; set; }
    }
}