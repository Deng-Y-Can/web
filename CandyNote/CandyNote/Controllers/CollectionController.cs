using CandyNote.Models;
using CandyNote.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CandyNote.Controllers
{
    [Authorize]
    public class CollectionController : Controller
    {
        private readonly ICollectionService _collectionService;

        public CollectionController(ICollectionService collectionService)
        {
            _collectionService = collectionService;
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(string name, string? description, int? parentId, CollectionPermission permission = CollectionPermission.Private)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(name))
                {
                    TempData["Error"] = "合集名称不能为空";
                    return RedirectToAction("Index", "Home");
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

                var collection = new Collection
                {
                    Name = name.Trim(),
                    Description = description?.Trim(),
                    Permission = permission,
                    ParentCollectionId = parentId,
                    CreatorId = userId
                };

                await _collectionService.CreateCollectionAsync(collection);

                TempData["Success"] = $"合集 \"{name}\" 创建成功！";
                return RedirectToAction("Index", "Home");
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"创建失败: {ex.Message}";
                return RedirectToAction("Index", "Home");
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, string name, string? description, CollectionPermission permission)
        {
            try
            {
                var collection = await _collectionService.GetCollectionByIdAsync(id);
                if (collection == null)
                {
                    return Json(new { success = false, message = "合集不存在" });
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                if (!isAdmin && collection.CreatorId != userId)
                {
                    return Json(new { success = false, message = "无权限" });
                }

                if (string.IsNullOrWhiteSpace(name))
                {
                    return Json(new { success = false, message = "名称不能为空" });
                }

                collection.Name = name.Trim();
                collection.Description = description?.Trim();
                collection.Permission = permission;

                await _collectionService.UpdateCollectionAsync(collection);

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var collection = await _collectionService.GetCollectionByIdAsync(id);
                if (collection == null)
                {
                    return Json(new { success = false, message = "合集不存在" });
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                if (!isAdmin && collection.CreatorId != userId)
                {
                    return Json(new { success = false, message = "无权限" });
                }

                await _collectionService.DeleteCollectionAsync(id);

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> ChangePermission(int id, [FromBody] int permission)
        {
            try
            {
                var collection = await _collectionService.GetCollectionByIdAsync(id);
                if (collection == null)
                {
                    return Json(new { success = false, message = "合集不存在" });
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                if (!isAdmin && collection.CreatorId != userId)
                {
                    return Json(new { success = false, message = "无权限" });
                }

                await _collectionService.ChangeCollectionPermissionAsync(id, (CollectionPermission)permission);

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> Detail(int id)
        {
            var collection = await _collectionService.GetCollectionByIdAsync(id);
            if (collection == null)
            {
                return NotFound();
            }

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && collection.Permission == CollectionPermission.Private && collection.CreatorId != userId)
            {
                return RedirectToAction("AccessDenied", "Account");
            }

            return View(collection);
        }
    }
}