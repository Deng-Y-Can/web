using CandyNote.Data;
using CandyNote.Models;
using Microsoft.EntityFrameworkCore;

namespace CandyNote.Services
{
    public class NoteService : INoteService
    {
        private readonly ApplicationDbContext _context;
        private readonly string _uploadPath = @"E:\CandyNote\uploads";

        public NoteService(ApplicationDbContext context)
        {
            _context = context;
            if (!Directory.Exists(_uploadPath))
            {
                Directory.CreateDirectory(_uploadPath);
            }
        }

        public async Task<Note> CreateNoteAsync(Note note)
        {
            _context.Notes.Add(note);
            await _context.SaveChangesAsync();
            return note;
        }

        public async Task<bool> UpdateNoteAsync(Note note)
        {
            var existing = await _context.Notes.FindAsync(note.Id);
            if (existing == null) return false;

            existing.Title = note.Title;
            existing.Content = note.Content;
            existing.Permission = note.Permission;
            existing.CollectionId = note.CollectionId;
            existing.UpdatedAt = note.UpdatedAt;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteNoteAsync(int noteId)
        {
            var note = await _context.Notes.FindAsync(noteId);
            if (note == null) return false;

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

        public async Task<Note?> GetNoteByIdAsync(int noteId)
        {
            return await _context.Notes
                .Include(n => n.User)
                .FirstOrDefaultAsync(n => n.Id == noteId);
        }

        public async Task<List<Note>> GetNotesByCollectionAsync(int? collectionId, int userId, bool isAdmin)
        {
            var query = _context.Notes
                .Include(n => n.User)
                .Where(n => n.CollectionId == collectionId);

            if (!isAdmin)
            {
                query = query.Where(n =>
                    n.Permission == NotePermission.Public ||
                    n.UserId == userId);
            }

            return await query
                .OrderByDescending(n => n.UpdatedAt)
                .ToListAsync();
        }

        public async Task<bool> ChangeNotePermissionAsync(int noteId, NotePermission newPermission)
        {
            var note = await _context.Notes.FindAsync(noteId);
            if (note == null) return false;

            note.Permission = newPermission;
            note.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<Note>> SearchNotesAsync(string keyword, int userId, bool isAdmin)
        {
            try
            {
                var query = _context.Notes
                    .Include(n => n.User)
                    .Where(n => n.Title.Contains(keyword) || n.Content.Contains(keyword));

                if (!isAdmin)
                {
                    query = query.Where(n =>
                        n.Permission == NotePermission.Public ||
                        n.UserId == userId);
                }

                return await query
                    .OrderByDescending(n => n.UpdatedAt)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"搜索笔记失败: {ex.Message}", ex);
            }
        }

        public async Task<(int successCount, int failCount)> BatchDeleteNotesAsync(List<int> noteIds, int userId, bool isAdmin)
        {
            int successCount = 0, failCount = 0;

            foreach (var id in noteIds)
            {
                var note = await _context.Notes.FindAsync(id);
                if (note == null)
                {
                    failCount++;
                    continue;
                }

                if (!isAdmin && note.UserId != userId)
                {
                    failCount++;
                    continue;
                }

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
                successCount++;
            }

            await _context.SaveChangesAsync();
            return (successCount, failCount);
        }

        public async Task<Note?> DuplicateNoteAsync(int sourceNoteId, int newUserId)
        {
            var sourceNote = await _context.Notes.FindAsync(sourceNoteId);
            if (sourceNote == null) return null;

            var newNote = new Note
            {
                Title = $"{sourceNote.Title} (副本)",
                Content = sourceNote.Content,
                Permission = NotePermission.Private,
                UserId = newUserId,
                CollectionId = sourceNote.CollectionId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Notes.Add(newNote);
            await _context.SaveChangesAsync();
            return newNote;
        }

        public async Task<bool> MoveNoteToCollectionAsync(int noteId, int? collectionId, int userId, bool isAdmin)
        {
            var note = await _context.Notes.FindAsync(noteId);
            if (note == null) return false;
            if (!isAdmin && note.UserId != userId) return false;

            note.CollectionId = collectionId;
            note.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<object> GetNoteStatsAsync(int userId, bool isAdmin)
        {
            var query = _context.Notes.AsQueryable();
            if (!isAdmin)
            {
                query = query.Where(n => n.Permission == NotePermission.Public || n.UserId == userId);
            }

            var allNotes = await query.ToListAsync();
            var userNotes = await _context.Notes.Where(n => n.UserId == userId).ToListAsync();

            return new
            {
                total = allNotes.Count,
                userTotal = userNotes.Count,
                publicCount = allNotes.Count(n => n.Permission == NotePermission.Public),
                privateCount = allNotes.Count(n => n.Permission == NotePermission.Private),
                todayCreated = allNotes.Count(n => n.CreatedAt.Date == DateTime.Today),
                thisWeekCreated = allNotes.Count(n => n.CreatedAt >= DateTime.Today.AddDays(-7))
            };
        }

        public async Task<string> ExportToMarkdownAsync(int noteId)
        {
            var note = await GetNoteByIdAsync(noteId);
            if (note == null) return string.Empty;

            var markdown = new System.Text.StringBuilder();
            markdown.AppendLine($"# {note.Title}");
            markdown.AppendLine();
            markdown.AppendLine($"**创建时间**: {note.CreatedAt:yyyy-MM-dd HH:mm:ss}");
            markdown.AppendLine($"**更新时间**: {note.UpdatedAt:yyyy-MM-dd HH:mm:ss}");
            markdown.AppendLine($"**权限**: {(note.Permission == NotePermission.Public ? "公开" : "私有")}");
            markdown.AppendLine();
            markdown.AppendLine("---");
            markdown.AppendLine();

            var content = note.Content ?? "";
            content = System.Text.RegularExpressions.Regex.Replace(content, "<h1>(.*?)</h1>", "# $1");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<h2>(.*?)</h2>", "## $1");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<h3>(.*?)</h3>", "### $1");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<strong>(.*?)</strong>", "**$1**");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<em>(.*?)</em>", "*$1*");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<a href=\"(.*?)\">(.*?)</a>", "[$2]($1)");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<img src=\"(.*?)\"", "![]($1)");
            content = System.Text.RegularExpressions.Regex.Replace(content, "<[^>]+>", "");

            markdown.Append(content);
            return markdown.ToString();
        }
    }
}