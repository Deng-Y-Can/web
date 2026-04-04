using CandyPlayer.Data;
using CandyPlayer.Models;
using Microsoft.EntityFrameworkCore;

namespace CandyPlayer.Services
{
    public class UserInitializerService
    {
        private readonly ApplicationDbContext _context;
        private readonly PasswordService _passwordService;
        private readonly ILogger<UserInitializerService> _logger;

        public UserInitializerService(
            ApplicationDbContext context,
            PasswordService passwordService,
            ILogger<UserInitializerService> logger)
        {
            _context = context;
            _passwordService = passwordService;
            _logger = logger;
        }

        public async Task InitializeUsersAsync()
        {
            if (await _context.Users.AnyAsync())
            {
                _logger.LogInformation("用户已存在，跳过初始化");
                return;
            }

            _logger.LogInformation("开始初始化用户...");
            var users = new List<User>();

            // 管理员账号
            users.Add(new User
            {
                Username = "zoe",
                PasswordHash = _passwordService.HashPassword("candy"),
                Role = UserRole.Admin,
                CreatedAt = DateTime.Now
            });

            // 普通用户 user1-user10
            for (int i = 1; i <= 10; i++)
            {
                users.Add(new User
                {
                    Username = $"user{i}",
                    PasswordHash = _passwordService.HashPassword("123456"),
                    Role = UserRole.NormalUser,
                    CreatedAt = DateTime.Now
                });
            }

            // 高级用户 huser1-huser10
            for (int i = 1; i <= 10; i++)
            {
                users.Add(new User
                {
                    Username = $"huser{i}",
                    PasswordHash = _passwordService.HashPassword("654321"),
                    Role = UserRole.AdvancedUser,
                    CreatedAt = DateTime.Now
                });
            }

            await _context.Users.AddRangeAsync(users);
            await _context.SaveChangesAsync();
            _logger.LogInformation($"用户初始化完成，共创建 {users.Count} 个用户");
        }
    }
}