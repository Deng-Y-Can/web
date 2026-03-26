using CandyNote.Data;
using CandyNote.Models;
using Microsoft.EntityFrameworkCore;

namespace CandyNote.Services
{
    public class UserService : IUserService
    {
        private readonly ApplicationDbContext _context;
        private readonly string _uploadPath = @"E:\CandyNote\uploads";

        public UserService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<User?> AuthenticateAsync(string username, string password)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == username && !u.IsDeleted);

            if (user == null)
                return null;

            if (BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return user;

            return null;
        }

        public async Task<User> CreateUserAsync(string username, string password, bool isAdmin = false)
        {
            var user = new User
            {
                Username = username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                IsAdmin = isAdmin,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return user;
        }

        public async Task<bool> UpdateUserAsync(int userId, string? newUsername, string? newPassword)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || user.IsDeleted)
                return false;

            if (!string.IsNullOrEmpty(newUsername))
                user.Username = newUsername;

            if (!string.IsNullOrEmpty(newPassword))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteUserAsync(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Notes)
                .Include(u => u.Collections)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || user.IsDeleted)
                return false;

            foreach (var note in user.Notes)
            {
                if (note.Permission == NotePermission.Public)
                {
                    // 公开笔记：保留但标记为已删除用户
                    note.UserId = -1;
                }
                else
                {
                    // 私有笔记：彻底删除，并删除关联的文件
                    // 从HTML内容中提取所有文件并删除
                    var fileUrls = ExtractFileUrlsFromContent(note.Content);
                    foreach (var url in fileUrls)
                    {
                        var filePath = Path.Combine(_uploadPath, Path.GetFileName(url));
                        if (File.Exists(filePath))
                        {
                            try { File.Delete(filePath); } catch { }
                        }
                    }
                    _context.Notes.Remove(note);
                }
            }

            // 删除用户创建的所有合集
            _context.Collections.RemoveRange(user.Collections);

            // 标记用户为已删除
            user.IsDeleted = true;
            user.Username = $"[Deleted_{user.Id}]";

            await _context.SaveChangesAsync();
            return true;
        }

        private List<string> ExtractFileUrlsFromContent(string content)
        {
            var urls = new List<string>();
            if (string.IsNullOrEmpty(content)) return urls;

            // 提取图片 src
            var imgMatches = System.Text.RegularExpressions.Regex.Matches(content, @"<img[^>]*src=""([^""]+)""");
            foreach (System.Text.RegularExpressions.Match match in imgMatches)
            {
                if (match.Groups[1].Success)
                    urls.Add(match.Groups[1].Value);
            }

            // 提取视频 source src
            var videoMatches = System.Text.RegularExpressions.Regex.Matches(content, @"<source[^>]*src=""([^""]+)""");
            foreach (System.Text.RegularExpressions.Match match in videoMatches)
            {
                if (match.Groups[1].Success)
                    urls.Add(match.Groups[1].Value);
            }

            // 提取链接 href (文件下载)
            var linkMatches = System.Text.RegularExpressions.Regex.Matches(content, @"<a[^>]*href=""([^""]+)""[^>]*download");
            foreach (System.Text.RegularExpressions.Match match in linkMatches)
            {
                if (match.Groups[1].Success)
                    urls.Add(match.Groups[1].Value);
            }

            return urls.Distinct().ToList();
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            return await _context.Users
                .Where(u => !u.IsDeleted)
                .OrderBy(u => u.Id)
                .ToListAsync();
        }

        public async Task<User?> GetUserByIdAsync(int userId)
        {
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
        }

        public async Task InitializeDefaultUsersAsync()
        {
            if (await _context.Users.AnyAsync())
                return;

            await CreateUserAsync("zoe", "candy", true);

            for (int i = 1; i <= 10; i++)
            {
                await CreateUserAsync($"user{i}", "123456", false);
            }

            await _context.SaveChangesAsync();
        }
    }
}