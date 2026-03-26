using CandyNote.Models;
using CandyNote.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.Security.Claims;
using System.Text.Json;

namespace CandyNote.Controllers
{
    [Authorize]
    public class NoteController : Controller
    {
        private readonly INoteService _noteService;
        private readonly ICollectionService _collectionService;
        private readonly string _uploadPath = @"E:\CandyNote\uploads";

        public NoteController(INoteService noteService, ICollectionService collectionService)
        {
            _noteService = noteService;
            _collectionService = collectionService;

            if (!Directory.Exists(_uploadPath))
            {
                Directory.CreateDirectory(_uploadPath);
            }
        }

        [HttpGet]
        public async Task<IActionResult> Create(int? collectionId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var collections = await _collectionService.GetUserCollectionsAsync(userId);

            ViewBag.Collections = new SelectList(collections, "Id", "Name", collectionId);
            ViewBag.CollectionId = collectionId;

            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Note note)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(note.Title))
                {
                    TempData["Error"] = "笔记标题不能为空";
                    return RedirectToAction("Create", new { collectionId = note.CollectionId });
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                note.UserId = userId;
                note.CreatedAt = DateTime.UtcNow;
                note.UpdatedAt = DateTime.UtcNow;

                await _noteService.CreateNoteAsync(note);

                TempData["Success"] = "笔记创建成功！";
                return RedirectToAction("Index", "Home", new { collectionId = note.CollectionId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"创建失败: {ex.Message}";
                return RedirectToAction("Create", new { collectionId = note.CollectionId });
            }
        }

        [HttpGet]
        public async Task<IActionResult> Edit(int id)
        {
            var note = await _noteService.GetNoteByIdAsync(id);
            if (note == null) return NotFound();

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && note.UserId != userId)
                return RedirectToAction("AccessDenied", "Account");

            var collections = await _collectionService.GetUserCollectionsAsync(userId);
            ViewBag.Collections = new SelectList(collections, "Id", "Name", note.CollectionId);

            return View(note);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, Note note)
        {
            try
            {
                if (id != note.Id) return NotFound();

                var existingNote = await _noteService.GetNoteByIdAsync(id);
                if (existingNote == null) return NotFound();

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                if (!isAdmin && existingNote.UserId != userId)
                    return RedirectToAction("AccessDenied", "Account");

                existingNote.Title = note.Title;
                existingNote.Content = note.Content;
                existingNote.Permission = note.Permission;
                existingNote.CollectionId = note.CollectionId;
                existingNote.UpdatedAt = DateTime.UtcNow;

                await _noteService.UpdateNoteAsync(existingNote);

                TempData["Success"] = "笔记更新成功！";
                return RedirectToAction("Index", "Home", new { collectionId = note.CollectionId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"更新失败: {ex.Message}";
                return RedirectToAction("Edit", new { id });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var note = await _noteService.GetNoteByIdAsync(id);
                if (note == null)
                    return Json(new { success = false, message = "笔记不存在" });

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                if (!isAdmin && note.UserId != userId)
                    return Json(new { success = false, message = "无权限删除此笔记" });

                await _noteService.DeleteNoteAsync(id);

                return Json(new { success = true, message = "删除成功" });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> View(int id)
        {
            var note = await _noteService.GetNoteByIdAsync(id);
            if (note == null) return NotFound();

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && note.Permission == NotePermission.Private && note.UserId != userId)
                return RedirectToAction("AccessDenied", "Account");

            return View(note);
        }

        [HttpPost]
        public async Task<IActionResult> ChangePermission(int id, [FromBody] int permission)
        {
            var note = await _noteService.GetNoteByIdAsync(id);
            if (note == null)
                return Json(new { success = false, message = "笔记不存在" });

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && note.UserId != userId)
                return Json(new { success = false, message = "无权限" });

            note.Permission = (NotePermission)permission;
            note.UpdatedAt = DateTime.UtcNow;
            await _noteService.UpdateNoteAsync(note);

            return Json(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return Json(new { success = false, message = "请选择文件" });

                var allowedImageTypes = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" };
                var allowedVideoTypes = new[] { ".mp4", ".webm", ".avi", ".mov", ".mkv" };
                var maxSizes = new Dictionary<string, long>
                {
                    ["image"] = 10 * 1024 * 1024,
                    ["video"] = 100 * 1024 * 1024,
                    ["document"] = 20 * 1024 * 1024
                };

                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                string fileType = "document";

                if (allowedImageTypes.Contains(extension))
                    fileType = "image";
                else if (allowedVideoTypes.Contains(extension))
                    fileType = "video";

                if (file.Length > maxSizes[fileType])
                    return Json(new { success = false, message = $"文件大小超过限制 ({maxSizes[fileType] / 1024 / 1024}MB)" });

                var fileName = $"{Guid.NewGuid():N}_{DateTime.Now:yyyyMMddHHmmss}_{file.FileName}";
                var filePath = Path.Combine(_uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                return Json(new
                {
                    success = true,
                    url = $"/uploads/{fileName}",
                    fileName = file.FileName,
                    fileType = fileType,
                    size = file.Length
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"上传失败: {ex.Message}" });
            }
        }
    }
}